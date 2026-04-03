using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ignis.Api.Tests;

public class IgnisApiFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;

    public IgnisApiFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["StoreSettings:ConnectionString"] = _connectionString,
                ["SparkSettings:Endpoint"] = "https://localhost/fhir",
                ["SparkSettings:FhirRelease"] = "R4",
                ["SparkSettings:UseAsynchronousIO"] = "true",
                ["AuthSettings:ConnectionString"] = _connectionString,
                ["AuthSettings:Clients:0:ClientId"] = "test-client",
                ["AuthSettings:Clients:0:ClientSecret"] = "test-secret",
                ["AuthSettings:Clients:0:DisplayName"] = "Test Client",
                ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
                ["AuthSettings:Clients:0:AllowedGrantTypes:1"] = "authorization_code",
                ["AuthSettings:Clients:0:RedirectUris:0"] = "http://localhost/callback",
            });
        });

        builder.ConfigureServices(services =>
        {
            services.AddSingleton<IStartupFilter, TestLoginStartupFilter>();
        });

        builder.UseEnvironment("Development");
    }
}
