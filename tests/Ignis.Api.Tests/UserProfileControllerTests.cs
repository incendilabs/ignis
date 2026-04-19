using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

using FluentAssertions;

using Ignis.Api.Users;
using Ignis.Auth.Authorization;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class UserProfileControllerTests : IClassFixture<IntegrationFixture>
{
    private readonly IntegrationFixture _fixture;

    public UserProfileControllerTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Get_WithoutAuth_ReturnsUnauthorized()
    {
        using var client = _fixture.Factory.CreateClient();

        var response = await client.GetAsync("/userprofile", CT);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Get_WithBearerToken_ReturnsSubject()
    {
        using var client = _fixture.Factory.CreateClient();
        var token = await _fixture.GetClientCredentialsTokenAsync(CT);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/userprofile", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var profile = await response.Content.ReadFromJsonAsync<UserProfile>(CT);
        profile.Should().NotBeNull();
        profile!.Subject.Should().NotBeNullOrEmpty();
        profile.Name.Should().Be("Test Client");
    }

    [Fact]
    public async Task Get_WithRequestedScope_IncludesScopeInProfile()
    {
        using var client = _fixture.Factory.CreateClient();
        var token = await _fixture.GetClientCredentialsTokenAsync(
            CT, OperationsScopes.Read);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await client.GetAsync("/userprofile", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var profile = await response.Content.ReadFromJsonAsync<UserProfile>(CT);
        profile.Should().NotBeNull();
        profile!.Scopes.Should().Contain(OperationsScopes.Read);
    }
}
