/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

using FluentAssertions;

using Ignis.Auth;
using Ignis.Auth.DataProtection;
using Ignis.Auth.Extensions;

using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;

using MongoDB.Driver;

namespace Ignis.Api.Tests;

/// <summary>
/// The Data Protection key ring lives in MongoDB, so cookies protected before a restart can
/// still be read afterwards.
/// </summary>
[Collection("IntegrationTests")]
public class DataProtectionPersistenceTests : IAsyncLifetime
{
    private const string Purpose = "Ignis.Tests.DataProtection";

    private readonly HashSet<string> _setEnvVars = new();
    private readonly string _connectionString;
    private readonly string _certificateDirectory =
        Path.Combine(Path.GetTempPath(), "ignis-dp-certs-" + Guid.NewGuid().ToString("N"));

    public DataProtectionPersistenceTests(MongoContainerFixture mongo) =>
        _connectionString = mongo.ConnectionStringForDatabase("ignis_dp_" + Guid.NewGuid().ToString("N"));

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public ValueTask DisposeAsync()
    {
        foreach (var key in _setEnvVars)
            Environment.SetEnvironmentVariable(key, null);
        if (Directory.Exists(_certificateDirectory))
            Directory.Delete(_certificateDirectory, recursive: true);
        return ValueTask.CompletedTask;
    }

    private void SetEnv(string key, string? value)
    {
        Environment.SetEnvironmentVariable(key, value);
        _setEnvVars.Add(key);
    }

    private IgnisApiFactory CreateFactory()
    {
        // Program binds AuthSettings before ConfigureAppConfiguration runs, so the auth
        // connection string must be a real environment variable.
        SetEnv("StoreSettings__ConnectionString", _connectionString);
        SetEnv("AuthSettings__ConnectionString", _connectionString);
        return new IgnisApiFactory(_connectionString);
    }

    private IMongoCollection<DataProtectionKeyDocument> KeysCollection() =>
        new MongoClient(_connectionString)
            .GetDatabase(MongoUrl.Create(_connectionString).DatabaseName)
            .GetCollection<DataProtectionKeyDocument>(AuthConstants.DataProtectionKeysCollection);

    [Fact]
    public async Task ProtectedPayload_SurvivesApiRestart()
    {
        string protectedPayload;
        await using (var first = CreateFactory())
        {
            protectedPayload = first.Services.GetRequiredService<IDataProtectionProvider>()
                .CreateProtector(Purpose)
                .Protect("session");
        }

        (await KeysCollection().CountDocumentsAsync(FilterDefinition<DataProtectionKeyDocument>.Empty,
            cancellationToken: TestContext.Current.CancellationToken)).Should().BeGreaterThan(0);

        await using var second = CreateFactory();
        second.Services.GetRequiredService<IDataProtectionProvider>()
            .CreateProtector(Purpose)
            .Unprotect(protectedPayload)
            .Should().Be("session");
    }

    [Fact]
    public void ProductionKeys_AreEncryptedAtRest_AndReadableAfterRestart()
    {
        var settings = new AuthSettings
        {
            ConnectionString = _connectionString,
            Certificates = new AuthCertificateSettings
            {
                SigningCertificatePath = WriteCertificate("signing"),
                SigningCertificatePassword = "test",
                EncryptionCertificatePath = WriteCertificate("encryption"),
                EncryptionCertificatePassword = "test",
            },
        };

        string protectedPayload;
        using (var first = BuildProductionServices(settings))
        {
            protectedPayload = first.GetRequiredService<IDataProtectionProvider>()
                .CreateProtector(Purpose)
                .Protect("session");
        }

        var stored = KeysCollection().Find(FilterDefinition<DataProtectionKeyDocument>.Empty)
            .ToList(cancellationToken: TestContext.Current.CancellationToken);
        stored.Should().NotBeEmpty();
        stored.Should().AllSatisfy(d => d.Xml.Should().Contain("EncryptedData").And.NotContain("<masterKey"));

        using var second = BuildProductionServices(settings);
        second.GetRequiredService<IDataProtectionProvider>()
            .CreateProtector(Purpose)
            .Unprotect(protectedPayload)
            .Should().Be("session");
    }

    private static ServiceProvider BuildProductionServices(AuthSettings settings)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddIgnisAuthServer(settings, useDevelopmentCertificates: false);
        return services.BuildServiceProvider();
    }

    private string WriteCertificate(string name)
    {
        Directory.CreateDirectory(_certificateDirectory);
        using var rsa = RSA.Create(2048);
        var request = new CertificateRequest(
            $"CN=Ignis Test {name}",
            rsa,
            HashAlgorithmName.SHA256,
            RSASignaturePadding.Pkcs1
        );
        using var certificate = request.CreateSelfSigned(
            DateTimeOffset.UtcNow.AddDays(-1),
            DateTimeOffset.UtcNow.AddDays(1)
        );
        var path = Path.Combine(_certificateDirectory, name + ".pfx");
        File.WriteAllBytes(path, certificate.Export(X509ContentType.Pfx, "test"));
        return path;
    }
}
