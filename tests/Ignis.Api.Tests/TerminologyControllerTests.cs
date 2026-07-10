/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;
using System.Net.Http.Headers;
using System.Text;

using FluentAssertions;

using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;
using Hl7.Fhir.Specification.Terminology;

using Xunit;

// Avoid clash with Hl7.Fhir.Model.Task
using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Tests;

/// <summary>End-to-end coverage of ValueSet <c>$expand</c> — by url, inline, and by stored id.</summary>
[Collection("IntegrationTests")]
public class TerminologyControllerTests : IClassFixture<IntegrationFixture>, IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _client;

    private readonly FhirJsonSerializer _serializer = new();
    private readonly FhirJsonDeserializer _deserializer = new();

    public TerminologyControllerTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.Factory.CreateClient();
    }

    public async ValueTask InitializeAsync()
    {
        var token = await _fixture.GetClientCredentialsTokenAsync(CT);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    public ValueTask DisposeAsync() => default;

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    private const string GenderValueSet = "http://hl7.org/fhir/ValueSet/administrative-gender";
    private const string GenderCodeSystem = "http://hl7.org/fhir/administrative-gender";

    [Fact]
    public async Task Expand_ByUrl_FromPackages_ReturnsCodes()
    {
        var response = await _client.GetAsync($"/fhir/ValueSet/$expand?url={Uri.EscapeDataString(GenderValueSet)}", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var expanded = _deserializer.Deserialize<ValueSet>(await response.Content.ReadAsStringAsync(CT));
        CodesOf(expanded).Should().BeEquivalentTo(new[] { "male", "female", "other", "unknown" });
    }

    [Fact]
    public async Task Expand_InlineValueSet_ReturnsCodes()
    {
        var parameters = new ExpandParameters().WithValueSet(null, GenderSubset(), null, null, null);

        var response = await PostFhir("ValueSet/$expand", parameters);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var expanded = _deserializer.Deserialize<ValueSet>(await response.Content.ReadAsStringAsync(CT));
        CodesOf(expanded).Should().BeEquivalentTo(new[] { "male", "female" });
    }

    [Fact]
    public async Task Expand_StoredValueSet_ById_ReturnsCodes()
    {
        var stored = GenderSubset();
        stored.Url = $"http://ignis.test/ValueSet/gender-{Guid.NewGuid():N}";

        var createResponse = await PostFhir("ValueSet", stored);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = _deserializer.Deserialize<ValueSet>(await createResponse.Content.ReadAsStringAsync(CT));

        var response = await _client.GetAsync($"/fhir/ValueSet/{created.Id}/$expand", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var expanded = _deserializer.Deserialize<ValueSet>(await response.Content.ReadAsStringAsync(CT));
        CodesOf(expanded).Should().BeEquivalentTo(new[] { "male", "female" });
    }

    [Fact]
    public async Task Expand_StoredValueSet_ById_ViaPost_ReturnsCodes()
    {
        var stored = GenderSubset();
        stored.Url = $"http://ignis.test/ValueSet/gender-{Guid.NewGuid():N}";

        var createResponse = await PostFhir("ValueSet", stored);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = _deserializer.Deserialize<ValueSet>(await createResponse.Content.ReadAsStringAsync(CT));

        // Spec-style POST: a Parameters body; {id} identifies the ValueSet to expand. (The local terminology
        // service ignores filter/count, so we assert the stored ValueSet expands rather than a narrowing.)
        var body = new Parameters();
        body.Add("activeOnly", new FhirBoolean(true));

        var response = await PostFhir($"ValueSet/{created.Id}/$expand", body);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var expanded = _deserializer.Deserialize<ValueSet>(await response.Content.ReadAsStringAsync(CT));
        CodesOf(expanded).Should().BeEquivalentTo(new[] { "male", "female" });
    }

    [Fact]
    public async Task Expand_ById_WithUrlParameter_IsRejected()
    {
        var response = await _client.GetAsync(
            $"/fhir/ValueSet/any-id/$expand?url={Uri.EscapeDataString(GenderValueSet)}", CT);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var outcome = _deserializer.Deserialize<OperationOutcome>(await response.Content.ReadAsStringAsync(CT));
        outcome.Issue.Should().Contain(i => i.Severity == OperationOutcome.IssueSeverity.Error);
    }

    [Fact]
    public async Task Expand_ById_WithInlineValueSet_IsRejected()
    {
        var body = new Parameters();
        body.Parameter.Add(new Parameters.ParameterComponent { Name = "valueSet", Resource = GenderSubset() });

        var response = await PostFhir("ValueSet/any-id/$expand", body);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var outcome = _deserializer.Deserialize<OperationOutcome>(await response.Content.ReadAsStringAsync(CT));
        outcome.Issue.Should().Contain(i => i.Severity == OperationOutcome.IssueSeverity.Error);
    }

    [Fact]
    public async Task Expand_UnknownUrl_SurfacesNoCodes()
    {
        var unknown = $"http://ignis.test/ValueSet/missing-{Guid.NewGuid():N}";

        var response = await _client.GetAsync($"/fhir/ValueSet/$expand?url={Uri.EscapeDataString(unknown)}", CT);

        // Firely resolves an unknown ValueSet url to an empty expansion (it does not throw), so no real codes
        // are surfaced. Stricter 404-on-unresolvable handling could be a later refinement.
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(CT);
        body.Should().NotContain("\"male\"");
    }

    // A small active ValueSet drawing two codes from the core administrative-gender code system.
    private static ValueSet GenderSubset() => new()
    {
        Status = PublicationStatus.Active,
        Compose = new ValueSet.ComposeComponent
        {
            Include =
            {
                new ValueSet.ConceptSetComponent
                {
                    System = GenderCodeSystem,
                    Concept =
                    {
                        new ValueSet.ConceptReferenceComponent { Code = "male" },
                        new ValueSet.ConceptReferenceComponent { Code = "female" },
                    },
                },
            },
        },
    };

    private static IEnumerable<string?> CodesOf(ValueSet expanded)
    {
        expanded.Expansion.Should().NotBeNull();
        return expanded.Expansion.Contains.Select(c => c.Code);
    }

    private async Task<HttpResponseMessage> PostFhir(string path, Resource resource)
    {
        var json = _serializer.SerializeToString(resource);
        using var content = new StringContent(json, Encoding.UTF8, "application/fhir+json");
        return await _client.PostAsync($"/fhir/{path}", content, CT);
    }
}
