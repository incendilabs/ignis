using System.Net;
using System.Text.Json;

using FluentAssertions;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class AuthorizationControllerTests : IClassFixture<IntegrationFixture>
{
    private readonly HttpClient _client;

    public AuthorizationControllerTests(IntegrationFixture fixture)
    {
        _client = fixture.Factory.CreateClient();
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Token_WithValidClientCredentials_ReturnsAccessToken()
    {
        var response = await _client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = "test-client",
                ["client_secret"] = "test-secret",
            }), CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(CT));
        json.RootElement.GetProperty("access_token").GetString().Should().NotBeNullOrEmpty();
        json.RootElement.GetProperty("token_type").GetString().Should().Be("Bearer");
    }

    [Fact]
    public async Task Token_WithInvalidClient_ReturnsUnauthorized()
    {
        var response = await _client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = "nonexistent",
                ["client_secret"] = "wrong",
            }), CT);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_WithWrongSecret_ReturnsUnauthorized()
    {
        var response = await _client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = "test-client",
                ["client_secret"] = "wrong-secret",
            }), CT);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_WithUnsupportedGrantType_ReturnsBadRequest()
    {
        var response = await _client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "password",
                ["client_id"] = "test-client",
                ["client_secret"] = "test-secret",
            }), CT);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
