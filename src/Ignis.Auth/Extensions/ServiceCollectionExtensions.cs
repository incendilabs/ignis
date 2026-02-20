using System.Security.Cryptography.X509Certificates;

using Ignis.Auth.Services;

using Microsoft.Extensions.DependencyInjection;

using MongoDB.Driver;

using OpenIddict.Server;

namespace Ignis.Auth.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddIgnisAuth(
        this IServiceCollection services,
        AuthSettings settings,
        bool useDevelopmentCertificates)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(settings.ConnectionString, "AuthSettings:ConnectionString is required when auth is enabled.");
        ArgumentNullException.ThrowIfNull(settings.Endpoints?.TokenEndpointPath, "AuthSettings:Endpoints:TokenEndpointPath is required when auth is enabled.");

        services.Configure<AuthSettings>(options =>
        {
            options.Enabled = settings.Enabled;
            options.ConnectionString = settings.ConnectionString;
            options.Clients = settings.Clients;
            options.Endpoints = settings.Endpoints;
            options.Certificates = settings.Certificates;
        });

        services.AddOpenIddict()
            .AddCore(options =>
            {
                options.UseMongoDb()
                    .UseDatabase(new MongoClient(settings.ConnectionString)
                        .GetDatabase(MongoUrl.Create(settings.ConnectionString).DatabaseName));
            })
            .AddServer(options =>
            {
                options
                    .SetTokenEndpointUris(settings.Endpoints.TokenEndpointPath)
                    .AllowClientCredentialsFlow();

                ConfigureCertificates(options, settings, useDevelopmentCertificates);

                var aspNetCoreBuilder = options
                    .UseAspNetCore()
                    .EnableTokenEndpointPassthrough();

                if (useDevelopmentCertificates)
                {
                    aspNetCoreBuilder.DisableTransportSecurityRequirement();
                }
            })
            .AddValidation(options =>
            {
                options.UseLocalServer();
                options.UseAspNetCore();
            });

        services.AddTransient<ClientSyncInitializer>();

        return services;
    }

    private static void ConfigureCertificates(
        OpenIddictServerBuilder options,
        AuthSettings settings,
        bool useDevelopmentCertificates)
    {
        if (useDevelopmentCertificates)
        {
            options
                .AddDevelopmentEncryptionCertificate()
                .AddDevelopmentSigningCertificate();
            return;
        }

        var certs = settings.Certificates;

        options
            .AddSigningCertificate(LoadCertificate(
                certs.SigningCertificatePath,
                certs.SigningCertificatePassword,
                "AuthSettings:Certificates:SigningCertificatePath"))
            .AddEncryptionCertificate(LoadCertificate(
                certs.EncryptionCertificatePath,
                certs.EncryptionCertificatePassword,
                "AuthSettings:Certificates:EncryptionCertificatePath"));
    }

    private static X509Certificate2 LoadCertificate(string path, string password, string settingName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path, settingName);
        ArgumentException.ThrowIfNullOrWhiteSpace(password, $"{settingName} is missing the required password.");
        var flags = OperatingSystem.IsLinux()
            ? X509KeyStorageFlags.EphemeralKeySet
            : X509KeyStorageFlags.DefaultKeySet;

        return X509CertificateLoader.LoadPkcs12FromFile(path, password, flags);
    }
}
