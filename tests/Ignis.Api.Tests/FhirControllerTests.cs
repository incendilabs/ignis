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

using Ignis.Api.Configuration;
using Ignis.Validation;

using Microsoft.Extensions.DependencyInjection;

using Xunit;

// Avoid clash with Hl7.Fhir.Model.Task
using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class FhirControllerTests : IClassFixture<IntegrationFixture>, IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _anonymousClient;
    private readonly HttpClient _client;

    private readonly FhirJsonSerializer _serializer = new();
    private readonly FhirJsonDeserializer _deserializer = new();

    public FhirControllerTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
        _anonymousClient = fixture.Factory.CreateClient();
        _client = fixture.Factory.CreateClient();
    }

    public async ValueTask InitializeAsync()
    {
        var token = await _fixture.GetClientCredentialsTokenAsync(CT);
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    public ValueTask DisposeAsync() => default;

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    // Auth enforcement

    [Fact]
    public async Task FhirEndpoint_WithoutAuth_ReturnsUnauthorized()
    {
        var response = await _anonymousClient.GetAsync("/fhir/Patient", CT);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // Metadata (AllowAnonymous)

    [Fact]
    public async Task Healthz_ReturnsOk()
    {
        var response = await _anonymousClient.GetAsync("/healthz", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Metadata_ReturnsCapabilityStatement()
    {
        var response = await _anonymousClient.GetAsync("/fhir/metadata", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync(CT);
        var resource = _deserializer.Deserialize<Resource>(body);
        resource.Should().BeOfType<CapabilityStatement>();
    }

    // Create + Read

    [Fact]
    public async Task Create_And_Read_Patient()
    {
        var patient = new Patient
        {
            Name = { new HumanName { Family = "Losen", Given = ["Skodde"] } },
            BirthDate = "1990-01-01",
        };

        // Create
        var createResponse = await PostFhirResource("Patient", patient);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var createdBody = await createResponse.Content.ReadAsStringAsync(CT);
        var created = _deserializer.Deserialize<Patient>(createdBody);
        created.Id.Should().NotBeNullOrEmpty();

        // Read
        var readResponse = await _client.GetAsync($"/fhir/Patient/{created.Id}", CT);
        readResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var readBody = await readResponse.Content.ReadAsStringAsync(CT);
        var read = _deserializer.Deserialize<Patient>(readBody);
        read.Name[0].Family.Should().Be("Losen");
    }

    // Type validation

    [Fact]
    public async Task Create_WithMismatchedType_ReturnsBadRequest()
    {
        var observation = new Observation
        {
            Status = ObservationStatus.Final,
            Code = new CodeableConcept("http://loinc.org", "72166-2"),
        };

        var response = await PostFhirResource("Patient", observation);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // Update

    [Fact]
    public async Task Update_ExistingPatient()
    {
        var patient = new Patient
        {
            Name = { new HumanName { Family = "Hansen" } },
        };

        var createResponse = await PostFhirResource("Patient", patient);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = _deserializer.Deserialize<Patient>(await createResponse.Content.ReadAsStringAsync(CT));
        created.Id.Should().NotBeNullOrEmpty();

        created.Name[0].Family = "Johansen";

        var updateResponse = await PutFhirResource($"Patient/{created.Id}", created);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var readResponse = await _client.GetAsync($"/fhir/Patient/{created.Id}", CT);
        readResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var read = _deserializer.Deserialize<Patient>(await readResponse.Content.ReadAsStringAsync(CT));
        read.Name[0].Family.Should().Be("Johansen");
    }

    // Delete

    [Fact]
    public async Task Delete_ExistingPatient_ReturnsNoContent()
    {
        var patient = new Patient
        {
            Name = { new HumanName { Family = "Sansen" } },
        };

        var createResponse = await PostFhirResource("Patient", patient);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = _deserializer.Deserialize<Patient>(await createResponse.Content.ReadAsStringAsync(CT));
        created.Id.Should().NotBeNullOrEmpty();

        var deleteResponse = await _client.DeleteAsync($"/fhir/Patient/{created.Id}", CT);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var readResponse = await _client.GetAsync($"/fhir/Patient/{created.Id}", CT);
        readResponse.StatusCode.Should().Be(HttpStatusCode.Gone);
    }

    // Search

    [Fact]
    public async Task Search_Patients_ReturnsBundle()
    {
        var response = await _client.GetAsync("/fhir/Patient", CT);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync(CT);
        var bundle = _deserializer.Deserialize<Bundle>(body);

        bundle.Type.Should().Be(Bundle.BundleType.Searchset);
    }

    // ConditionalDelete guard

    [Fact]
    public async Task ConditionalDelete_WithoutParams_ReturnsBadRequest()
    {
        var response = await _client.DeleteAsync("/fhir/Patient", CT);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // History

    [Fact]
    public async Task History_ReturnsBundle()
    {
        var patient = new Patient
        {
            Name = { new HumanName { Family = "Larsen" } },
        };

        var createResponse = await PostFhirResource("Patient", patient);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = _deserializer.Deserialize<Patient>(await createResponse.Content.ReadAsStringAsync(CT));
        created.Id.Should().NotBeNullOrEmpty();

        var historyResponse = await _client.GetAsync($"/fhir/Patient/{created.Id}/_history", CT);
        historyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await historyResponse.Content.ReadAsStringAsync(CT);
        var bundle = _deserializer.Deserialize<Bundle>(body);

        bundle.Type.Should().Be(Bundle.BundleType.History);
        bundle.Entry.Should().NotBeEmpty();
    }

    // Transaction validation

    [Fact]
    public async Task Transaction_WithInvalidBundleType_ReturnsBadRequest()
    {
        var bundle = new Bundle { Type = Bundle.BundleType.Collection };

        var response = await PostFhirResource(string.Empty, bundle);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // $validate (structural profile validation)

    [Fact]
    public async Task Validate_NonConformantResource_Returns200WithErrorOutcome()
    {
        // Parses fine, but declares (and violates) the vital-signs profile — so profile validation fails.
        var observation = new Observation
        {
            Status = ObservationStatus.Final,
            Code = new CodeableConcept("http://loinc.org", "85354-9"),
            Meta = new Meta { Profile = ["http://hl7.org/fhir/StructureDefinition/vitalsigns"] },
        };

        var response = await PostFhirResource("Observation/$validate", observation);

        // $validate reports findings in the outcome; it does not fail the request.
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var outcome = _deserializer.Deserialize<OperationOutcome>(await response.Content.ReadAsStringAsync(CT));
        outcome.Issue.Should().Contain(i => i.Severity == OperationOutcome.IssueSeverity.Error);
    }

    [Fact]
    public async Task Validate_ConformantResource_Returns200WithoutErrors()
    {
        var response = await PostFhirResource("Patient/$validate", new Patient { Active = true });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var outcome = _deserializer.Deserialize<OperationOutcome>(await response.Content.ReadAsStringAsync(CT));
        outcome.Issue.Should().NotContain(i =>
            i.Severity == OperationOutcome.IssueSeverity.Error || i.Severity == OperationOutcome.IssueSeverity.Fatal);
    }

    // Helpers

    private async Task<HttpResponseMessage> PostFhirResource(string path, Resource resource)
    {
        var json = _serializer.SerializeToString(resource);
        using var content = new StringContent(json, Encoding.UTF8, "application/fhir+json");
        return await _client.PostAsync($"/fhir/{path}", content, CT);
    }

    private async Task<HttpResponseMessage> PutFhirResource(string path, Resource resource)
    {
        var json = _serializer.SerializeToString(resource);
        using var content = new StringContent(json, Encoding.UTF8, "application/fhir+json");
        return await _client.PutAsync($"/fhir/{path}", content, CT);
    }

    // $validate — permissive parsing

    private async Task<HttpResponseMessage> PostValidate(string type, string body)
    {
        using var content = new StringContent(body, Encoding.UTF8, "application/fhir+json");
        return await _client.PostAsync($"/fhir/{type}/$validate", content, CT);
    }

    [Fact]
    public async Task Validate_InvalidCodedValue_ReportsIssuesInsteadOfRejecting()
    {
        // "mann" is not an administrative-gender code; the strict store parser would 400 on the
        // enum, but $validate parses permissively and reports it as a finding.
        var response = await PostValidate("Practitioner", """
            { "resourceType": "Practitioner", "gender": "mann" }
            """);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var outcome = _deserializer.Deserialize<OperationOutcome>(await response.Content.ReadAsStringAsync(CT));

        var errorExpressions = outcome.Issue
            .Where(i => i.Severity == OperationOutcome.IssueSeverity.Error)
            .SelectMany(i => i.Expression ?? Enumerable.Empty<string>())
            .OfType<string>();
        errorExpressions.Should().Contain(e => e.Contains("gender"));
    }

    [Fact]
    public async Task Validate_ValidResource_ReturnsOutcomeWithoutErrors()
    {
        var response = await PostValidate("Practitioner", """
            { "resourceType": "Practitioner", "gender": "male" }
            """);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var outcome = _deserializer.Deserialize<OperationOutcome>(await response.Content.ReadAsStringAsync(CT));
        outcome.Issue.Should().NotContain(i =>
            i.Severity == OperationOutcome.IssueSeverity.Error || i.Severity == OperationOutcome.IssueSeverity.Fatal);
    }

    [Fact]
    public async Task Validate_UnparseableBody_ReturnsBadRequest()
    {
        var response = await PostValidate("Practitioner", "this is not json at all");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Validate_TypeMismatch_ReturnsBadRequest()
    {
        var response = await PostValidate("Patient", """
            { "resourceType": "Practitioner" }
            """);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Validate_InvalidCodedValue_InStrictMode_ReturnsBadRequest()
    {
        // The same body the permissive test reports as a finding: under Validation:Parsing=Strict the
        // parser rejects it, so the config flag must flip the endpoint from 200-with-findings to 400.
        using var factory = _fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
                services.PostConfigure<ValidationSettings>(o => o.Parsing = ResourceParsingMode.Strict)));

        using var client = factory.CreateClient();
        var token = await _fixture.GetClientCredentialsTokenAsync(CT);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = new StringContent(
            """{ "resourceType": "Practitioner", "gender": "mann" }""", Encoding.UTF8, "application/fhir+json");
        var response = await client.PostAsync("/fhir/Practitioner/$validate", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
