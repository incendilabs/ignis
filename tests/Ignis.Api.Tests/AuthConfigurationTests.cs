using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

using FluentAssertions;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

using MongoDB.Driver;

using Testcontainers.MongoDb;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class AuthConfigurationTests : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder()
        .WithImage("mongo:8")
        .Build();

    private string _connectionString = "";

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await _mongo.StartAsync();
        var raw = _mongo.GetConnectionString();
        var mongoUrl = new MongoUrlBuilder(raw) { DatabaseName = "ignis_auth_test" };
        if (string.IsNullOrWhiteSpace(mongoUrl.AuthenticationSource))
            mongoUrl.AuthenticationSource = "admin";
        _connectionString = mongoUrl.ToString();
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    private void SetEnvVars(Dictionary<string, string?> vars)
    {
        foreach (var (key, value) in vars)
            Environment.SetEnvironmentVariable(key, value);
    }

    private void ClearEnvVars(Dictionary<string, string?> vars)
    {
        foreach (var key in vars.Keys)
            Environment.SetEnvironmentVariable(key, null);
    }

    private WebApplicationFactory<Program> CreateFactory(
        Dictionary<string, string?> config,
        string environment = "Development")
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(config));
            builder.UseEnvironment(environment);
        });
    }

    private static string CreateTempCertificate(string subject, string password)
    {
        using var rsa = RSA.Create(2048);
        var req = new CertificateRequest(
            $"CN={subject}", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var cert = req.CreateSelfSigned(DateTimeOffset.Now, DateTimeOffset.Now.AddYears(1));
        var path = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.pfx");
        File.WriteAllBytes(path, cert.Export(X509ContentType.Pfx, password));
        return path;
    }

    [Fact]
    public async Task TokenEndpoint_NotAvailable_WhenAuthDisabled()
    {
        var envVars = new Dictionary<string, string?>
        {
            ["AuthSettings__Enabled"] = "false",
            ["AuthSettings__ConnectionString"] = _connectionString,
            ["StoreSettings__ConnectionString"] = _connectionString,
        };
        SetEnvVars(envVars);
        try
        {
            await using var factory = CreateFactory(new Dictionary<string, string?>
            {
                ["StoreSettings:ConnectionString"] = _connectionString,
                ["SparkSettings:Endpoint"] = "https://localhost/fhir",
                ["SparkSettings:FhirRelease"] = "R4",
                ["SparkSettings:UseAsynchronousIO"] = "true",
                ["AuthSettings:Enabled"] = "false",
                ["AuthSettings:ConnectionString"] = _connectionString,
            });
            using var client = factory.CreateClient();

            var response = await client.PostAsync("/connect/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "client_credentials",
                    ["client_id"] = "test-client",
                    ["client_secret"] = "test-secret",
                }), CT);

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
        finally
        {
            ClearEnvVars(envVars);
        }
    }

    [Fact]
    public async Task TokenEndpoint_Available_WhenAuthEnabled()
    {
        var envVars = new Dictionary<string, string?>
        {
            ["AuthSettings__Enabled"] = "true",
            ["AuthSettings__ConnectionString"] = _connectionString,
            ["AuthSettings__Clients__0__ClientId"] = "config-client",
            ["AuthSettings__Clients__0__ClientSecret"] = "config-secret",
            ["AuthSettings__Clients__0__DisplayName"] = "Config Client",
            ["AuthSettings__Clients__0__AllowedGrantTypes__0"] = "client_credentials",
            ["StoreSettings__ConnectionString"] = _connectionString,
        };
        SetEnvVars(envVars);
        try
        {
            await using var factory = CreateFactory(new Dictionary<string, string?>
            {
                ["StoreSettings:ConnectionString"] = _connectionString,
                ["SparkSettings:Endpoint"] = "https://localhost/fhir",
                ["SparkSettings:FhirRelease"] = "R4",
                ["SparkSettings:UseAsynchronousIO"] = "true",
                ["AuthSettings:Enabled"] = "true",
                ["AuthSettings:ConnectionString"] = _connectionString,
                ["AuthSettings:Clients:0:ClientId"] = "config-client",
                ["AuthSettings:Clients:0:ClientSecret"] = "config-secret",
                ["AuthSettings:Clients:0:DisplayName"] = "Config Client",
                ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
            });
            using var client = factory.CreateClient();

            var response = await client.PostAsync("/connect/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "client_credentials",
                    ["client_id"] = "config-client",
                    ["client_secret"] = "config-secret",
                }), CT);

            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }
        finally
        {
            ClearEnvVars(envVars);
        }
    }

    [Fact]
    public async Task TokenEndpoint_Works_WithCertificatesInProduction()
    {
        var signingCertPassword = "test-signing-cert-password";
        var encryptionCertPassword = "test-encryption-cert-password";
        var signingCertPath = CreateTempCertificate("Ignis Token Signing Test", signingCertPassword);
        var encryptionCertPath = CreateTempCertificate("Ignis Token Encryption Test", encryptionCertPassword);
        try
        {
            var envVars = new Dictionary<string, string?>
            {
                ["AuthSettings__Enabled"] = "true",
                ["AuthSettings__ConnectionString"] = _connectionString,
                ["AuthSettings__Clients__0__ClientId"] = "cert-client",
                ["AuthSettings__Clients__0__ClientSecret"] = "cert-secret",
                ["AuthSettings__Clients__0__DisplayName"] = "Cert Client",
                ["AuthSettings__Clients__0__AllowedGrantTypes__0"] = "client_credentials",
                ["AuthSettings__Certificates__SigningCertificatePath"] = signingCertPath,
                ["AuthSettings__Certificates__SigningCertificatePassword"] = signingCertPassword,
                ["AuthSettings__Certificates__EncryptionCertificatePath"] = encryptionCertPath,
                ["AuthSettings__Certificates__EncryptionCertificatePassword"] = encryptionCertPassword,
                ["StoreSettings__ConnectionString"] = _connectionString,
            };
            SetEnvVars(envVars);
            try
            {
                await using var factory = CreateFactory(new Dictionary<string, string?>
                {
                    ["StoreSettings:ConnectionString"] = _connectionString,
                    ["SparkSettings:Endpoint"] = "https://localhost/fhir",
                    ["SparkSettings:FhirRelease"] = "R4",
                    ["SparkSettings:UseAsynchronousIO"] = "true",
                    ["AuthSettings:Enabled"] = "true",
                    ["AuthSettings:ConnectionString"] = _connectionString,
                    ["AuthSettings:Clients:0:ClientId"] = "cert-client",
                    ["AuthSettings:Clients:0:ClientSecret"] = "cert-secret",
                    ["AuthSettings:Clients:0:DisplayName"] = "Cert Client",
                    ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
                    ["AuthSettings:Certificates:SigningCertificatePath"] = signingCertPath,
                    ["AuthSettings:Certificates:SigningCertificatePassword"] = signingCertPassword,
                    ["AuthSettings:Certificates:EncryptionCertificatePath"] = encryptionCertPath,
                    ["AuthSettings:Certificates:EncryptionCertificatePassword"] = encryptionCertPassword,
                }, environment: "Production");
                using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
                {
                    BaseAddress = new Uri("https://localhost"),
                });

                var response = await client.PostAsync("/connect/token",
                    new FormUrlEncodedContent(new Dictionary<string, string>
                    {
                        ["grant_type"] = "client_credentials",
                        ["client_id"] = "cert-client",
                        ["client_secret"] = "cert-secret",
                    }), CT);

                response.StatusCode.Should().Be(HttpStatusCode.OK);
            }
            finally
            {
                ClearEnvVars(envVars);
            }
        }
        finally
        {
            File.Delete(signingCertPath);
            File.Delete(encryptionCertPath);
        }
    }

    [Fact]
    public void Startup_Fails_WhenCertificatesMissing_InProduction()
    {
        var envVars = new Dictionary<string, string?>
        {
            ["AuthSettings__Enabled"] = "true",
            ["AuthSettings__ConnectionString"] = _connectionString,
            ["AuthSettings__Clients__0__ClientId"] = "cert-client",
            ["AuthSettings__Clients__0__ClientSecret"] = "cert-secret",
            ["AuthSettings__Clients__0__AllowedGrantTypes__0"] = "client_credentials",
            ["StoreSettings__ConnectionString"] = _connectionString,
        };
        SetEnvVars(envVars);
        try
        {
            var act = () =>
            {
                using var factory = CreateFactory(new Dictionary<string, string?>
                {
                    ["StoreSettings:ConnectionString"] = _connectionString,
                    ["SparkSettings:Endpoint"] = "https://localhost/fhir",
                    ["SparkSettings:FhirRelease"] = "R4",
                    ["SparkSettings:UseAsynchronousIO"] = "true",
                    ["AuthSettings:Enabled"] = "true",
                    ["AuthSettings:ConnectionString"] = _connectionString,
                    ["AuthSettings:Clients:0:ClientId"] = "cert-client",
                    ["AuthSettings:Clients:0:ClientSecret"] = "cert-secret",
                    ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
                }, environment: "Production");
                factory.CreateClient();
            };

            act.Should().Throw<ArgumentException>()
                .WithMessage("*SigningCertificatePath*");
        }
        finally
        {
            ClearEnvVars(envVars);
        }
    }
}
