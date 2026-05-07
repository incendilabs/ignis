/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;
using System.Net.Http.Headers;

using FluentAssertions;

using Ignis.Api.Configuration;
using Ignis.Auth.Authorization;

using Microsoft.Extensions.DependencyInjection;

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

    private static MultipartFormDataContent BuildArchiveContent()
    {
        var content = new MultipartFormDataContent();
        var bytes = new byte[] { 0x50, 0x4B, 0x03, 0x04 }; // ZIP magic number
        var fileContent = new ByteArrayContent(bytes);
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

        using var content = BuildArchiveContent();
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
}
