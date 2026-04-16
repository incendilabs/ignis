using System.Net;

using FluentAssertions;

using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.SignalR.Client;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class OperationProgressHubTests : IClassFixture<IntegrationFixture>
{
    private readonly IntegrationFixture _fixture;

    public OperationProgressHubTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Connect_WithOperationsReadScope_Succeeds()
    {
        var token = await _fixture.GetClientCredentialsTokenAsync(CT, OperationsScopes.Read);

        await using var hub = _fixture.BuildHubConnection("/hubs/operations", token);

        await hub.StartAsync(CT);

        hub.State.Should().Be(HubConnectionState.Connected);
    }

    [Fact]
    public async Task Connect_WithoutOperationsReadScope_Fails()
    {
        var token = await _fixture.GetClientCredentialsTokenAsync(CT);

        await using var hub = _fixture.BuildHubConnection("/hubs/operations", token);

        var act = async () => await hub.StartAsync(CT);

        var ex = await act.Should().ThrowAsync<HttpRequestException>();
        ex.Which.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
