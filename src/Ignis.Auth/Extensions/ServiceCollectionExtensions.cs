using Ignis.Auth.Services;

using Microsoft.Extensions.DependencyInjection;

using MongoDB.Driver;

namespace Ignis.Auth.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddIgnisAuth(
        this IServiceCollection services,
        AuthSettings settings,
        bool useDevelopmentCertificates)
    {
        services.Configure<AuthSettings>(options =>
        {
            options.Enabled = settings.Enabled;
            options.ConnectionString = settings.ConnectionString;
            options.Clients = settings.Clients;
            options.Endpoints = settings.Endpoints;
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
                var endpoints = settings.Endpoints;

                options
                    .SetTokenEndpointUris(endpoints.TokenEndpointPath)
                    .AllowClientCredentialsFlow();

                if (useDevelopmentCertificates)
                {
                    options
                        .AddDevelopmentEncryptionCertificate()
                        .AddDevelopmentSigningCertificate();
                }

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
}
