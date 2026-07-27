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

using Xunit;

using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Tests;

/// <summary>End-to-end coverage of <c>GET /fhir/$packages</c>.</summary>
[Collection("IntegrationTests")]
public class PackagesControllerTests : IClassFixture<IntegrationFixture>, IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _client;
    private readonly HttpClient _anonymousClient;
    private readonly FhirJsonDeserializer _deserializer = new();

    public PackagesControllerTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.Factory.CreateClient();
        _anonymousClient = fixture.Factory.CreateClient();
    }

    public async ValueTask InitializeAsync()
    {
        var token = await _fixture.GetClientCredentialsTokenAsync(CT);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    public ValueTask DisposeAsync() => default;

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    private const string PackagesUrl = "/fhir/$packages";

    [Fact]
    public async Task Packages_WithoutAuth_ReturnsUnauthorized()
    {
        var response = await _anonymousClient.GetAsync(PackagesUrl, CT);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Packages_ReturnsParametersOfInstalledPackages()
    {
        var response = await _client.GetAsync(PackagesUrl, CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var parameters = _deserializer.Deserialize<Parameters>(await response.Content.ReadAsStringAsync(CT));

        // Wiring/shape check, not a content assertion: exercises whatever the host has loaded and
        // verifies each entry's shape. File-name parsing to id/version is pinned in PackageRefTests.
        parameters.Parameter.Should().OnlyContain(p =>
            p.Name == "package" && p.Part.Any(part => part.Name == "id"));
    }
}
