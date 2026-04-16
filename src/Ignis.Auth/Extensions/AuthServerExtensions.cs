using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;

using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

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

        services.AddSingleton(Options.Create(settings));

        services
            .AddSessionCookieAuthentication(settings.Endpoints.LoginPath)
            .AddExternalProviders(settings.ExternalProviders)
            .AddOpenIddictServer(settings, useDevelopmentCertificates)
            .AddOpenIddictValidation();

        services.AddTransient<AuthorizationHandler>();

        services.AddSingleton<IAuthorizationPolicyProvider, ScopeAuthorizationPolicyProvider>();
        services.AddSingleton<IAuthorizationHandler, ScopeAuthorizationHandler>();

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

    private static IServiceCollection AddExternalProviders(
        this IServiceCollection services,
        List<ExternalProviderSettings> providers)
    {
        foreach (var provider in providers)
        {
            switch (provider.Type)
            {
                case ExternalProviderType.GitHub:
                    services.AddGitHubOAuth(provider);
                    break;
                case ExternalProviderType.OIDC:
                    services.AddOidcProvider(provider);
                    break;
                default:
                    throw new InvalidOperationException(
                        $"Unsupported external provider type '{provider.Type}' for provider '{provider.Name}'.");
            }
        }

        return services;
    }

    private static void AddGitHubOAuth(this IServiceCollection services, ExternalProviderSettings provider)
    {
        services.AddAuthentication()
            .AddOAuth(provider.Name, options =>
            {
                var endpoints = WellKnownOAuthEndpoints.GitHub;
                options.ClientId = provider.ClientId;
                options.ClientSecret = provider.ClientSecret;
                options.AuthorizationEndpoint = endpoints.AuthorizationEndpoint;
                options.TokenEndpoint = endpoints.TokenEndpoint;
                options.UserInformationEndpoint = endpoints.UserInformationEndpoint;
                options.CallbackPath = $"/connect/login-callback-{provider.Name.ToLowerInvariant()}";
                options.SignInScheme = AuthConstants.SessionScheme;

                options.ClaimActions.MapJsonKey(ClaimTypes.NameIdentifier, "id");
                options.ClaimActions.MapJsonKey(ClaimTypes.Name, "name");
                options.ClaimActions.MapJsonKey("urn:github:avatar", "avatar_url");

                options.Events.OnCreatingTicket = async context =>
                {
                    using var request = new HttpRequestMessage(HttpMethod.Get, context.Options.UserInformationEndpoint);
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", context.AccessToken);
                    request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                    request.Headers.UserAgent.Add(new ProductInfoHeaderValue("Ignis.Auth", "0.1.0"));
                    using var response = await context.Backchannel.SendAsync(request, context.HttpContext.RequestAborted);
                    response.EnsureSuccessStatusCode();
                    var user = await response.Content.ReadFromJsonAsync<JsonElement>(context.HttpContext.RequestAborted);
                    context.RunClaimActions(user);
                };
            });
    }

    private static void AddOidcProvider(this IServiceCollection services, ExternalProviderSettings provider)
    {
        // OpenID Connect providers will be supported in a future version.
        throw new NotSupportedException(
            $"OpenID Connect provider '{provider.Name}' is not yet supported. Currently only 'GitHub' is available as a built-in provider.");
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
                    .RequirePushedAuthorizationRequests()
                    .RegisterScopes(KnownScopes.All.ToArray());

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
