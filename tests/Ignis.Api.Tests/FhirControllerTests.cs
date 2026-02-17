using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

using FluentAssertions;

using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Tests;

public class FhirControllerTests : IClassFixture<IgnisApiFactory>
{
    private readonly HttpClient _client;
    private readonly FhirJsonSerializer _serializer = new();
    private readonly FhirJsonParser _parser = new();

    public FhirControllerTests(IgnisApiFactory factory)
    {
        _client = factory.CreateClient();
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    // ============= Metadata

    [Fact]
    public async Task Metadata_ReturnsCapabilityStatement()
    {
        var response = await _client.GetAsync("/fhir/metadata", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync(CT);
        var resource = _parser.Parse<Resource>(body);
        resource.Should().BeOfType<CapabilityStatement>();
    }

    // ============= Create + Read

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
        var created = _parser.Parse<Patient>(createdBody);
        created.Id.Should().NotBeNullOrEmpty();

        // Read
        var readResponse = await _client.GetAsync($"/fhir/Patient/{created.Id}", CT);
        readResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var readBody = await readResponse.Content.ReadAsStringAsync(CT);
        var read = _parser.Parse<Patient>(readBody);
        read.Name[0].Family.Should().Be("Losen");
    }

    // ============= Type validation

    [Fact]
    public async Task Create_WithMismatchedType_ReturnsBadRequest()
    {
        var observation = new Observation
        {
            Status = ObservationStatus.Final,
            Code = new CodeableConcept("http://loinc.org", "72166-2")
        };

        // Post an Observation to the Patient endpoint
        var response = await PostFhirResource("Patient", observation);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ============= Update

    [Fact]
    public async Task Update_ExistingPatient()
    {
        var patient = new Patient
        {
            Name = { new HumanName { Family = "Hansen" } },
        };

        var createResponse = await PostFhirResource("Patient", patient);
        var created = _parser.Parse<Patient>(await createResponse.Content.ReadAsStringAsync(CT));

        created.Name[0].Family = "Johansen";

        var updateResponse = await PutFhirResource($"Patient/{created.Id}", created);
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var readResponse = await _client.GetAsync($"/fhir/Patient/{created.Id}", CT);
        var read = _parser.Parse<Patient>(await readResponse.Content.ReadAsStringAsync(CT));
        read.Name[0].Family.Should().Be("Johansen");
    }

    // ============= Delete

    [Fact]
    public async Task Delete_ExistingPatient_ReturnsNoContent()
    {
        var patient = new Patient
        {
            Name = { new HumanName { Family = "Sansen" } },
        };

        var createResponse = await PostFhirResource("Patient", patient);
        var created = _parser.Parse<Patient>(await createResponse.Content.ReadAsStringAsync(CT));

        var deleteResponse = await _client.DeleteAsync($"/fhir/Patient/{created.Id}", CT);
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var readResponse = await _client.GetAsync($"/fhir/Patient/{created.Id}", CT);
        readResponse.StatusCode.Should().Be(HttpStatusCode.Gone);
    }

    // ============= Search

    [Fact]
    public async Task Search_Patients_ReturnsBundle()
    {
        var response = await _client.GetAsync("/fhir/Patient", CT);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync(CT);
        var bundle = _parser.Parse<Bundle>(body);
        bundle.Type.Should().Be(Bundle.BundleType.Searchset);
    }

    // ============= ConditionalDelete guard

    [Fact]
    public async Task ConditionalDelete_WithoutParams_ReturnsBadRequest()
    {
        var response = await _client.DeleteAsync("/fhir/Patient", CT);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ============= History

    [Fact]
    public async Task History_ReturnsBundle()
    {
        var patient = new Patient
        {
            Name = { new HumanName { Family = "Larsen" } },
        };

        var createResponse = await PostFhirResource("Patient", patient);
        var created = _parser.Parse<Patient>(await createResponse.Content.ReadAsStringAsync(CT));

        var historyResponse = await _client.GetAsync($"/fhir/Patient/{created.Id}/_history", CT);
        historyResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await historyResponse.Content.ReadAsStringAsync(CT);
        var bundle = _parser.Parse<Bundle>(body);
        bundle.Type.Should().Be(Bundle.BundleType.History);
        bundle.Entry.Should().NotBeEmpty();
    }

    // ============= Transaction validation

    [Fact]
    public async Task Transaction_WithInvalidBundleType_ReturnsBadRequest()
    {
        var bundle = new Bundle { Type = Bundle.BundleType.Collection };
        var response = await PostFhirResource(string.Empty, bundle);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ============= Helpers

    private async Task<HttpResponseMessage> PostFhirResource(string path, Resource resource)
    {
        var json = await _serializer.SerializeToStringAsync(resource);
        var content = new StringContent(json, Encoding.UTF8, "application/fhir+json");
        return await _client.PostAsync($"/fhir/{path}", content, CT);
    }

    private async Task<HttpResponseMessage> PutFhirResource(string path, Resource resource)
    {
        var json = await _serializer.SerializeToStringAsync(resource);
        var content = new StringContent(json, Encoding.UTF8, "application/fhir+json");
        return await _client.PutAsync($"/fhir/{path}", content, CT);
    }
}
