/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Collections.Concurrent;
using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Threading.Channels;

using FluentAssertions;

using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

using Ignis.Api.Configuration;
using Ignis.Api.Hubs;
using Ignis.Api.Services.Operations;
using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;

// Avoid clash with Hl7.Fhir.Model.Task
using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class ImportControllerTests : IClassFixture<IntegrationFixture>
{
    private readonly IntegrationFixture _fixture;

    public ImportControllerTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    private static async Task<(Guid Id, string Message)> WaitForEventAsync(
        ChannelReader<(Guid Id, string Message)> reader,
        Guid expectedId,
        TimeSpan timeout,
        CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout);
        while (true)
        {
            var ev = await reader.ReadAsync(cts.Token);
            if (ev.Id == expectedId) return ev;
        }
    }

    private static MultipartFormDataContent BuildArchiveContent()
    {
        var content = new MultipartFormDataContent();
        var bytes = new byte[] { 0x50, 0x4B, 0x03, 0x04 }; // ZIP magic number
        var fileContent = new ByteArrayContent(bytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
        content.Add(fileContent, "file", "archive.zip");
        return content;
    }

    private static MultipartFormDataContent BuildValidZipContent(int entryCount)
    {
        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            for (var i = 0; i < entryCount; i++)
                zip.CreateEntry($"entry-{i}.json");
        }
        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(ms.ToArray());
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/zip");
        content.Add(fileContent, "file", "archive.zip");
        return content;
    }

    [Fact]
    public async Task ArchiveImport_WithoutAuth_ReturnsUnauthorized()
    {
        using var client = _fixture.Factory.CreateClient();

        using var content = BuildArchiveContent();
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ArchiveImport_WithTokenWithoutImportScope_ReturnsForbidden()
    {
        using var client = _fixture.Factory.CreateClient();

        var token = await _fixture.GetClientCredentialsTokenAsync(CT, OperationsScopes.Read);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildArchiveContent();
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ArchiveImport_WithImportScope_ReturnsAccepted()
    {
        using var client = _fixture.Factory.CreateClient();

        var token = await _fixture.GetClientCredentialsTokenAsync(CT, OperationsScopes.Import);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildArchiveContent();
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
    }

    [Fact]
    public async Task ArchiveImport_WithFeatureDisabled_ReturnsServiceUnavailable()
    {
        using var factory = _fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
                services.PostConfigure<FeatureSettings>(o => o.AllowImport = false)));

        using var client = factory.CreateClient();
        var token = await _fixture.GetClientCredentialsTokenAsync(CT, OperationsScopes.Import);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildArchiveContent();
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task ArchiveImport_WithValidZip_PublishesCountSummary()
    {
        var token = await _fixture.GetClientCredentialsTokenAsync(
            CT, $"{OperationsScopes.Import} {OperationsScopes.Read}");

        await using var hub = _fixture.BuildHubConnection("/hubs/operations", token);

        // ConcurrentQueue + Channel — SignalR callbacks run on thread-pool threads.
        var progressEvents = new ConcurrentQueue<(Guid Id, string Message)>();
        var completedEvents = Channel.CreateUnbounded<(Guid Id, string Message)>();
        hub.On<Guid, string, OperationProgress?>(
            OperationProgressHubMethods.Progress,
            (id, msg, _) => progressEvents.Enqueue((id, msg)));
        hub.On<Guid, string>(
            OperationProgressHubMethods.Completed,
            (id, msg) => completedEvents.Writer.TryWrite((id, msg)));

        await hub.StartAsync(CT);

        using var client = _fixture.Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildValidZipContent(entryCount: 3);
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Accepted);

        var outcome = new FhirJsonParser().Parse<OperationOutcome>(
            await response.Content.ReadAsStringAsync(CT));
        var operationId = Guid.Parse(outcome.Id);

        var completed = await WaitForEventAsync(
            completedEvents.Reader, operationId, TimeSpan.FromSeconds(5), CT);
        completed.Message.Should().Contain("3");

        var ourProgress = progressEvents
            .Where(e => e.Id == operationId)
            .Select(e => e.Message)
            .ToList();
        ourProgress.Should().Contain(m => m.Contains('3'));
        ourProgress.Should().Contain(m => m.Contains("entry-0.json"));
        ourProgress.Should().Contain(m => m.Contains("entry-2.json"));
    }

    [Fact]
    public async Task ArchiveImport_WithInvalidZipBytes_PublishesError()
    {
        var token = await _fixture.GetClientCredentialsTokenAsync(
            CT, $"{OperationsScopes.Import} {OperationsScopes.Read}");

        await using var hub = _fixture.BuildHubConnection("/hubs/operations", token);

        var errorEvents = Channel.CreateUnbounded<(Guid Id, string Message)>();
        hub.On<Guid, string>(
            OperationProgressHubMethods.Error,
            (id, msg) => errorEvents.Writer.TryWrite((id, msg)));

        await hub.StartAsync(CT);

        using var client = _fixture.Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildArchiveContent();
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Accepted);

        var outcome = new FhirJsonParser().Parse<OperationOutcome>(
            await response.Content.ReadAsStringAsync(CT));
        var operationId = Guid.Parse(outcome.Id);

        var error = await WaitForEventAsync(
            errorEvents.Reader, operationId, TimeSpan.FromSeconds(5), CT);
        error.Message.Should().Contain("zip");
    }
}
