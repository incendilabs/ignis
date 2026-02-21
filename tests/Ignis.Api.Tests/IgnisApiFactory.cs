using System.Security.Claims;

using Ignis.Auth;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
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
                ["AuthSettings:Enabled"] = "true",
                ["AuthSettings:ConnectionString"] = _connectionString,
                ["AuthSettings:Clients:0:ClientId"] = "test-client",
                ["AuthSettings:Clients:0:ClientSecret"] = "test-secret",
                ["AuthSettings:Clients:0:DisplayName"] = "Test Client",
                ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
                ["AuthSettings:Clients:0:RedirectUris:0"] = "http://localhost/callback",
            });
        });

        builder.ConfigureServices(services =>
        {
            services.AddSingleton<IStartupFilter, TestLoginStartupFilter>();
        });

        builder.UseEnvironment("Development");
    }

    /// <summary>
    /// Adds a <c>/test-login</c> endpoint that signs in as a test user
    /// using the <see cref="AuthConstants.SessionScheme"/> cookie scheme.
    /// </summary>
    private sealed class TestLoginStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
        {
            return app =>
            {
                app.Use(async (context, nextMiddleware) =>
                {
                    if (context.Request.Path == "/test-login")
                    {
                        var claims = new List<Claim>
                        {
                            new(ClaimTypes.NameIdentifier, "test-user-id"),
                            new(ClaimTypes.Name, "Test User"),
                        };
                        var identity = new ClaimsIdentity(claims, AuthConstants.SessionScheme);
                        await context.SignInAsync(
                            AuthConstants.SessionScheme, new ClaimsPrincipal(identity));
                        context.Response.StatusCode = StatusCodes.Status200OK;
                        return;
                    }

                    await nextMiddleware();
                });
                next(app);
            };
        }
    }
}
