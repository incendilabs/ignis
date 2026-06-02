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

    private static async Task<OperationSummary> WaitForCompletedAsync(
        ChannelReader<(Guid Id, OperationSummary Summary)> reader,
        Guid expectedId,
        TimeSpan timeout,
        CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(timeout);
        while (true)
        {
            var ev = await reader.ReadAsync(cts.Token);
            if (ev.Id == expectedId) return ev.Summary;
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

    private static MultipartFormDataContent BuildZipWithPatient(string patientId)
        => BuildZipWithPatient($"{patientId}.json", patientId);

    private static MultipartFormDataContent BuildZipWithPatient(string entryName, string patientId)
    {
        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            var entry = zip.CreateEntry(entryName);
            using var entryStream = entry.Open();
            using var writer = new StreamWriter(entryStream);
            writer.Write($$"""
                {
                  "resourceType": "Patient",
                  "id": "{{patientId}}",
                  "name": [{ "family": "Imported", "given": ["Test"] }]
                }
                """);
        }
        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(buffer.ToArray());
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

        // Valid (empty) zip so the synchronous probe accepts it; the scope check is the focus.
        using var content = BuildValidZipContent(entryCount: 0);
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
        var completedEvents = Channel.CreateUnbounded<(Guid Id, OperationSummary Summary)>();
        hub.On<Guid, string, OperationProgress?>(
            OperationProgressHubMethods.Progress,
            (id, msg, _) => progressEvents.Enqueue((id, msg)));
        hub.On<Guid, OperationSummary>(
            OperationProgressHubMethods.Completed,
            (id, summary) => completedEvents.Writer.TryWrite((id, summary)));

        await hub.StartAsync(CT);

        using var client = _fixture.Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildValidZipContent(entryCount: 3);
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Accepted);

        var outcome = new FhirJsonDeserializer().Deserialize<OperationOutcome>(
            await response.Content.ReadAsStringAsync(CT));
        var operationId = Guid.Parse(outcome.Id);

        var summary = await WaitForCompletedAsync(
            completedEvents.Reader, operationId, TimeSpan.FromSeconds(5), CT);
        summary.Message.Should().Contain("3");
        // Empty .json entries fail FHIR parsing — every entry should land in Failed.
        summary.Statistics.Should().NotBeNull();
        summary.Statistics!.Total.Should().Be(3);
        summary.Statistics.Failed.Should().Be(3);
        summary.Statistics.Succeeded.Should().Be(0);

        var ourProgress = progressEvents
            .Where(e => e.Id == operationId)
            .Select(e => e.Message)
            .ToList();
        ourProgress.Should().Contain(m => m.Contains('3'));
        ourProgress.Should().Contain(m => m.Contains("entry-0.json"));
        ourProgress.Should().Contain(m => m.Contains("entry-2.json"));
    }

    [Fact]
    public async Task ArchiveImport_WithJsonPatient_PersistsResourceToStore()
    {
        // Unique id keeps the test isolated from other tests that may share the store.
        var patientId = $"import-test-{Guid.NewGuid():N}";

        var token = await _fixture.GetClientCredentialsTokenAsync(
            CT, $"{OperationsScopes.Import} {OperationsScopes.Read}");

        await using var hub = _fixture.BuildHubConnection("/hubs/operations", token);
        var completedEvents = Channel.CreateUnbounded<(Guid Id, string Message)>();
        hub.On<Guid, OperationSummary>(
            OperationProgressHubMethods.Completed,
            (id, summary) => completedEvents.Writer.TryWrite((id, summary.Message)));
        await hub.StartAsync(CT);

        using var client = _fixture.Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildZipWithPatient(patientId);
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);

        var outcome = new FhirJsonDeserializer().Deserialize<OperationOutcome>(
            await response.Content.ReadAsStringAsync(CT));
        var operationId = Guid.Parse(outcome.Id);

        await WaitForEventAsync(
            completedEvents.Reader, operationId, TimeSpan.FromSeconds(10), CT);

        var readResponse = await client.GetAsync($"/fhir/Patient/{patientId}", CT);
        readResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await readResponse.Content.ReadAsStringAsync(CT);
        body.Should().Contain(patientId);
        body.Should().Contain("Imported");
    }

    [Fact]
    public async Task ArchiveImport_WhenArchiveExceedsTotalUncompressedLimit_ReturnsRequestEntityTooLarge()
    {
        // 50 bytes is well below any valid FHIR resource — guaranteed trip.
        using var factory = _fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
                services.PostConfigure<ImportSettings>(o => o.MaxArchiveUncompressedBytes = 50)));

        var token = await _fixture.GetClientCredentialsTokenAsync(CT, OperationsScopes.Import);

        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildZipWithPatient($"limit-test-{Guid.NewGuid():N}");
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.RequestEntityTooLarge);
    }

    [Fact]
    public async Task ArchiveImport_WhenEntryExceedsSizeLimit_SkipsEntry()
    {
        // 10 bytes < smallest valid Patient JSON — entry is skipped, import completes.
        using var factory = _fixture.Factory.WithWebHostBuilder(builder =>
            builder.ConfigureServices(services =>
                services.PostConfigure<ImportSettings>(o => o.MaxEntryUncompressedBytes = 10)));

        var token = await _fixture.GetClientCredentialsTokenAsync(
            CT, $"{OperationsScopes.Import} {OperationsScopes.Read}");

        await using var hub = IntegrationFixture.BuildHubConnection(factory, "/hubs/operations", token);
        var completedEvents = Channel.CreateUnbounded<(Guid Id, string Message)>();
        hub.On<Guid, OperationSummary>(
            OperationProgressHubMethods.Completed,
            (id, summary) => completedEvents.Writer.TryWrite((id, summary.Message)));
        await hub.StartAsync(CT);

        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var patientId = $"oversize-test-{Guid.NewGuid():N}";
        using var content = BuildZipWithPatient(patientId);
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);

        var outcome = new FhirJsonDeserializer().Deserialize<OperationOutcome>(
            await response.Content.ReadAsStringAsync(CT));
        var operationId = Guid.Parse(outcome.Id);

        await WaitForEventAsync(completedEvents.Reader, operationId, TimeSpan.FromSeconds(5), CT);

        var readResponse = await client.GetAsync($"/fhir/Patient/{patientId}", CT);
        readResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ArchiveImport_WithInvalidZipBytes_ReturnsBadRequest()
    {
        using var client = _fixture.Factory.CreateClient();
        var token = await _fixture.GetClientCredentialsTokenAsync(CT, OperationsScopes.Import);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var content = BuildArchiveContent();
        var response = await client.PostAsync("/fhir/$archive-import", content, CT);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
