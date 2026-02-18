using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

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
                ["AuthSettings:Enabled"] = "true",
                ["AuthSettings:ConnectionString"] = _connectionString,
                ["AuthSettings:Clients:0:ClientId"] = "test-client",
                ["AuthSettings:Clients:0:ClientSecret"] = "test-secret",
                ["AuthSettings:Clients:0:DisplayName"] = "Test Client",
            });
        });

        builder.UseEnvironment("Development");
    }
}
