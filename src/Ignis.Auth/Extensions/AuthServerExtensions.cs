using System.Security.Cryptography.X509Certificates;

using Microsoft.Extensions.DependencyInjection;

using MongoDB.Driver;

using OpenIddict.Server;

namespace Ignis.Auth.Extensions;

public static class AuthServerExtensions
{
    /// <summary>
    /// Registers the OpenIddict authorization server and certificates.
    /// Use this when the application acts as an authorization server.
    /// </summary>
    public static IServiceCollection AddIgnisAuthServer(
        this IServiceCollection services,
        AuthSettings settings,
        bool useDevelopmentCertificates)
    {
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentException.ThrowIfNullOrWhiteSpace(settings.ConnectionString);

        services.Configure<AuthSettings>(options =>
        {
            options.ConnectionString = settings.ConnectionString;
            options.Clients = settings.Clients;
            options.Endpoints = settings.Endpoints;
            options.Certificates = settings.Certificates;
        });

        services.AddOpenIddictServer(settings, useDevelopmentCertificates);
        services.AddOpenIddict()
            .AddValidation(options =>
            {
                options.UseLocalServer();
                options.UseAspNetCore();
            });

        services.AddTransient<AuthorizationHandler>();

        return services;
    }

    private static void AddOpenIddictServer(
        this IServiceCollection services,
        AuthSettings settings,
        bool useDevelopmentCertificates)
    {
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

                ConfigureCertificates(options, settings.Certificates, useDevelopmentCertificates);

                var aspNetCoreBuilder = options
                    .UseAspNetCore()
                    .EnableTokenEndpointPassthrough();

                if (useDevelopmentCertificates)
                    aspNetCoreBuilder.DisableTransportSecurityRequirement();
            });
    }

    private static void ConfigureCertificates(
        OpenIddictServerBuilder options,
        AuthCertificateSettings certs,
        bool useDevelopmentCertificates)
    {
        if (useDevelopmentCertificates)
        {
            options
                .AddDevelopmentEncryptionCertificate()
                .AddDevelopmentSigningCertificate();
            return;
        }

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
