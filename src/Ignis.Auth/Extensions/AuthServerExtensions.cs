using System.Security.Cryptography.X509Certificates;

using Ignis.Auth;

using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

using MongoDB.Driver;

namespace Ignis.Auth.Extensions;

public static class AuthServerExtensions
{
    /// <summary>
    /// Registers the OpenIddict authorization server, token validation,
    /// session cookie authentication and certificates.
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

        services
            .AddSessionCookieAuthentication(settings.Endpoints.LoginPath)
            .AddOpenIddictServer(settings, useDevelopmentCertificates)
            .AddOpenIddictValidation();

        services.AddTransient<AuthorizationHandler>();

        return services;
    }

    private static IServiceCollection AddSessionCookieAuthentication(
        this IServiceCollection services,
        string loginPath)
    {
        services.AddAuthentication()
            .AddCookie(AuthConstants.SessionScheme, options =>
            {
                options.LoginPath = new PathString("/" + loginPath.TrimStart('/'));
                // Always issue a 302 redirect; the default cookie handler
                // returns 401 for non-browser requests (missing Accept: text/html),
                // which breaks the OAuth 2.0 authorization endpoint flow.
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.Redirect(context.RedirectUri);
                    return Task.CompletedTask;
                };
            });

        return services;
    }

    private static IServiceCollection AddOpenIddictServer(
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
                    .SetTokenEndpointUris("connect/token")
                    .SetAuthorizationEndpointUris("connect/authorize")
                    .SetPushedAuthorizationEndpointUris("connect/par")
                    .AllowClientCredentialsFlow()
                    .AllowAuthorizationCodeFlow()
                    .RequireProofKeyForCodeExchange()
                    .RequirePushedAuthorizationRequests();

                ConfigureCertificates(options, settings.Certificates, useDevelopmentCertificates);

                var aspNetCoreBuilder = options
                    .UseAspNetCore()
                    .EnableTokenEndpointPassthrough()
                    .EnableAuthorizationEndpointPassthrough();

                if (useDevelopmentCertificates)
                    aspNetCoreBuilder.DisableTransportSecurityRequirement();
            });

        return services;
    }

    private static IServiceCollection AddOpenIddictValidation(this IServiceCollection services)
    {
        services.AddOpenIddict()
            .AddValidation(options =>
            {
                options.UseLocalServer();
                options.UseAspNetCore();
            });

        return services;
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
