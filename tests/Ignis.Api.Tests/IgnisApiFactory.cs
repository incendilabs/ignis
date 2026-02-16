
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Testcontainers.MongoDb;

namespace Ignis.Api.Tests;

public class IgnisApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MongoDbContainer _mongoContainer = new MongoDbBuilder()
        .WithImage("mongo:8")
        .Build();

    public async ValueTask InitializeAsync()
    {
        await _mongoContainer.StartAsync();
    }

    async ValueTask IAsyncDisposable.DisposeAsync()
    {
        await _mongoContainer.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["StoreSettings:ConnectionString"] = _mongoContainer.GetConnectionString() + "/ignis_test",
                ["SparkSettings:Endpoint"] = "https://localhost/fhir",
                ["SparkSettings:FhirRelease"] = "R4",
                ["SparkSettings:UseAsynchronousIO"] = "true",
            });
        });

        builder.UseEnvironment("Development");
    }
}