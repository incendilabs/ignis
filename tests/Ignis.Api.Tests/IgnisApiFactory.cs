/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Ignis.Api.Tests;

public class IgnisApiFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;
    private readonly Dictionary<string, string?> _extraConfig;
    private readonly Action<IServiceCollection>? _configureServices;

    public IgnisApiFactory(
        string connectionString,
        Dictionary<string, string?>? extraConfig = null,
        Action<IServiceCollection>? configureServices = null)
    {
        _connectionString = connectionString;
        _extraConfig = extraConfig ?? [];
        _configureServices = configureServices;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            var baseConfig = new Dictionary<string, string?>
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
            };
            foreach (var (key, value) in _extraConfig)
                baseConfig[key] = value;
            config.AddInMemoryCollection(baseConfig);
        });

        builder.ConfigureServices(services =>
        {
            services.AddSingleton<IStartupFilter, TestLoginStartupFilter>();
            _configureServices?.Invoke(services);
        });

        builder.UseEnvironment("Test");
    }
}
