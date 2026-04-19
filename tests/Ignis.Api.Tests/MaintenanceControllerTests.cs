/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;
using System.Net.Http.Headers;

using FluentAssertions;

using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

using Ignis.Api.Configuration;
using Ignis.Api.Hubs;
using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

// Avoid clash with Hl7.Fhir.Model.Task
using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class MaintenanceControllerTests : IClassFixture<IntegrationFixture>
{
    private readonly IntegrationFixture _fixture;

    public MaintenanceControllerTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    [Fact]
    public async Task ClearStore_WithoutAuth_ReturnsUnauthorized()
    {
        using var client = _fixture.Factory.CreateClient();

        var response = await client.PostAsync("/fhir/$clear-store", null, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ClearStore_WithTokenWithoutDestructiveScope_ReturnsForbidden()
    {
        using var client = _fixture.Factory.CreateClient();

        var token = await _fixture.GetClientCredentialsTokenAsync(CT);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsync("/fhir/$clear-store", null, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ClearStore_WithDestructiveScope_ReturnsOk()
    {
        using var client = _fixture.Factory.CreateClient();

        var token = await _fixture.GetClientCredentialsTokenAsync(
            CT, MaintenanceScopes.DatabaseDestructive);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsync("/fhir/$clear-store", null, CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ClearStore_WithFeatureDisabled_ReturnsNotFound()
    {
        using var factory = _fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
                services.PostConfigure<FeatureSettings>(o => o.AllowClearStore = false)));

        using var client = factory.CreateClient();
        var token = await _fixture.GetClientCredentialsTokenAsync(
            CT, MaintenanceScopes.DatabaseDestructive);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.PostAsync("/fhir/$clear-store", null, CT);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ClearStore_PublishesCompletedEventToHub()
    {
        using var client = _fixture.Factory.CreateClient();
        var token = await _fixture.GetClientCredentialsTokenAsync(
            CT, $"{MaintenanceScopes.DatabaseDestructive} {OperationsScopes.Read}");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var completed = new TaskCompletionSource<(Guid Id, string Message)>(
            TaskCreationOptions.RunContinuationsAsynchronously);

        await using var hub = _fixture.BuildHubConnection("/hubs/operations", token);

        hub.On<Guid, string>(OperationProgressHubMethods.Completed, (id, message) =>
            completed.TrySetResult((id, message)));

        await hub.StartAsync(CT);

        var response = await client.PostAsync("/fhir/$clear-store", null, CT);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var outcome = new FhirJsonParser().Parse<OperationOutcome>(
            await response.Content.ReadAsStringAsync(CT));
        var responseOperationId = Guid.Parse(outcome.Id);

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(CT);
        timeout.CancelAfter(TimeSpan.FromSeconds(10));

        var (hubOperationId, message) = await completed.Task.WaitAsync(timeout.Token);

        hubOperationId.Should().Be(responseOperationId);
        message.Should().Be("Store cleared.");
    }
}
