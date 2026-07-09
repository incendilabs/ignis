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
// Avoid clash with Hl7.Fhir.Model.Task
using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Tests;

/// <summary>
/// End-to-end proof that <c>$validate</c> resolves profiles from the FHIR store (via
/// <c>StoreCanonicalResolver</c>), including latest-active-by-semver selection — things Spark's package
/// resolver alone cannot do.
/// </summary>
[Collection("IntegrationTests")]
public class CanonicalResolutionTests : IClassFixture<IntegrationFixture>, IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _client;

    private readonly FhirJsonSerializer _serializer = new();
    private readonly FhirJsonDeserializer _deserializer = new();

    public CanonicalResolutionTests(IntegrationFixture fixture)
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

    [Fact]
    public async Task Validate_AgainstStoredProfile_ResolvesFromStoreAndEnforcesConstraint()
    {
        // A catalog-authored profile that constrains Patient.name to 1..* — resolvable only from the store,
        // not from the FHIR packages.
        var url = $"https://ignis.test/StructureDefinition/required-{Guid.NewGuid():N}";
        await CreateAsync("StructureDefinition",
            RequireElement(url, "1.0.0", PublicationStatus.Active, "Patient.name"));

        // A Patient without a name violates the stored profile → the specific "missing name" error, proving
        // the store profile was resolved and enforced (a "could not be resolved" issue would not match).
        var missingName = await ValidateAsync("Patient", new Patient { Active = true }, url);
        missingName.Issue.Should().Contain(i => ReportsMissing(i, "name"));

        // A conformant Patient → no errors
        var withName = await ValidateAsync("Patient",
            new Patient { Name = { new HumanName { Family = "Losen" } } }, url);
        withName.Issue.Should().NotContain(i =>
            i.Severity == OperationOutcome.IssueSeverity.Error || i.Severity == OperationOutcome.IssueSeverity.Fatal);
    }

    [Fact]
    public async Task Validate_PicksLatestActive_ButHonoursExactVersionPin()
    {
        // Two versions of the same canonical: v1.0.0 (draft, requires name) and v2.0.0 (active, requires gender).
        var url = $"https://ignis.test/StructureDefinition/patient-versions-{Guid.NewGuid():N}";
        await CreateAsync("StructureDefinition", RequireElement(url, "1.0.0", PublicationStatus.Draft, "Patient.name"));
        await CreateAsync("StructureDefinition",
            RequireElement(url, "2.0.0", PublicationStatus.Active, "Patient.gender"));

        // Has a name, but no gender.
        var patient = new Patient { Name = { new HumanName { Family = "Losen" } } };

        // Bare canonical → latest active = v2.0.0, which requires gender (absent here). Asserting that
        // specific error proves v2 was applied — not v1 (name is present, would pass) and not "unresolved".
        var latest = await ValidateAsync("Patient", patient, url);
        latest.Issue.Should().Contain(i => ReportsMissing(i, "gender"));

        // Pinned to the draft v1.0.0 (requires name, which is present) → no errors.
        var pinned = await ValidateAsync("Patient", patient, $"{url}|1.0.0");
        pinned.Issue.Should().NotContain(i =>
            i.Severity == OperationOutcome.IssueSeverity.Error || i.Severity == OperationOutcome.IssueSeverity.Fatal);
    }

    // Helpers

    // The validator reports a missing required element as e.g. "Missing required member: 'gender'" in the
    // issue details. Matching the quoted element pins the error to the stored profile's specific constraint:
    // a "profile could not be resolved" issue names the url, never a quoted element, so it cannot match.
    private static bool ReportsMissing(OperationOutcome.IssueComponent issue, string element) =>
        issue.Severity == OperationOutcome.IssueSeverity.Error
        && issue.Details?.Text?.Contains($"'{element}'", StringComparison.Ordinal) == true;

    private static StructureDefinition
        RequireElement(string url, string version, PublicationStatus status, string path) =>
        new()
        {
            Url = url,
            Version = version,
            Name = "IgnisTestProfile",
            Status = status,
            Kind = StructureDefinition.StructureDefinitionKind.Resource,
            Abstract = false,
            Type = "Patient",
            BaseDefinition = "http://hl7.org/fhir/StructureDefinition/Patient",
            Derivation = StructureDefinition.TypeDerivationRule.Constraint,
            Differential = new StructureDefinition.DifferentialComponent
            {
                Element =
                {
                    new ElementDefinition { Path = "Patient" }, new ElementDefinition { Path = path, Min = 1 },
                },
            },
        };

    private async Task CreateAsync(string type, Resource resource)
    {
        var json = _serializer.SerializeToString(resource);
        using var content = new StringContent(json, Encoding.UTF8, "application/fhir+json");
        var response = await _client.PostAsync($"/fhir/{type}", content, CT);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    private async Task<OperationOutcome> ValidateAsync(string type, Resource resource, string profile)
    {
        var path = $"/fhir/{type}/$validate?profile={Uri.EscapeDataString(profile)}";
        var json = _serializer.SerializeToString(resource);
        using var content = new StringContent(json, Encoding.UTF8, "application/fhir+json");

        var response = await _client.PostAsync(path, content, CT);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return _deserializer.Deserialize<OperationOutcome>(await response.Content.ReadAsStringAsync(CT));
    }
}
