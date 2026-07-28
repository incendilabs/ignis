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

// Avoid clash with Hl7.Fhir.Model.Task
using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Tests;

/// <summary>End-to-end coverage of <c>GET /fhir/StructureDefinition/$profiles</c>.</summary>
[Collection("IntegrationTests")]
public class ProfilesControllerTests : IClassFixture<IntegrationFixture>, IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _client;
    private readonly HttpClient _anonymousClient;
    private readonly FhirJsonDeserializer _deserializer = new();

    public ProfilesControllerTests(IntegrationFixture fixture)
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

    private const string ProfilesUrl = "/fhir/StructureDefinition/$profiles";

    [Fact]
    public async Task Profiles_WithoutAuth_ReturnsUnauthorized()
    {
        var response = await _anonymousClient.GetAsync(ProfilesUrl, CT);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Profiles_ReturnsSearchsetBundleOfStructureDefinitions()
    {
        var response = await _client.GetAsync(ProfilesUrl, CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var bundle = _deserializer.Deserialize<Bundle>(await response.Content.ReadAsStringAsync(CT));

        bundle.Type.Should().Be(Bundle.BundleType.Searchset);
        // Wiring/shape check, not a content assertion: exercises whatever the host has loaded and
        // verifies the per-entry mapping. The filtering (constraint resource profiles only) and the
        // metadata are pinned deterministically in SupportedProfileGroupingTests.
        foreach (var entry in bundle.Entry)
        {
            var definition = entry.Resource.Should().BeOfType<StructureDefinition>().Subject;
            definition.Url.Should().NotBeNull();
            definition.Name.Should().NotBeNull();
            definition.Type.Should().NotBeNull();
            definition.Kind.Should().Be(StructureDefinition.StructureDefinitionKind.Resource);
            definition.Abstract.Should().BeFalse();
            definition.Derivation.Should().Be(StructureDefinition.TypeDerivationRule.Constraint);
        }
    }

    [Fact]
    public async Task Metadata_AdvertisesTheProfilesAndPackagesOperations()
    {
        // metadata is anonymous; the custom operations should be discoverable there.
        var response = await _anonymousClient.GetAsync("/fhir/metadata", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var capability = _deserializer.Deserialize<CapabilityStatement>(await response.Content.ReadAsStringAsync(CT));

        const string operationBase = "http://incendi.com/fhir/OperationDefinition/";

        var rest = capability.Rest.Should().ContainSingle().Subject;
        var packages = rest.Operation.Should().ContainSingle(o => o.Name == "packages").Subject;
        packages.Definition.Should().Be(operationBase + "packages");

        var structureDefinition = rest.Resource.Single(r => r.Type?.ToString() == "StructureDefinition");
        var profiles = structureDefinition.Operation.Should().ContainSingle(o => o.Name == "profiles").Subject;
        profiles.Definition.Should().Be(operationBase + "profiles");
    }
}
