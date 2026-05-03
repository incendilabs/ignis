/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;

using Ignis.Api.Configuration;
using Ignis.Api.Extensions;
using Ignis.Api.Hubs;
using Ignis.Api.Services.Maintenance;
using Ignis.Api.Services.Operations;
using Ignis.Auth;
using Ignis.Auth.Extensions;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;

using OpenIddict.Validation.AspNetCore;

using Serilog;

using Spark.Engine;
using Spark.Engine.Extensions;
using Spark.Mongo.Extensions;

var builder = WebApplication.CreateBuilder(args);

if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true);
}

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

// Bind Spark FHIR settings from configuration
var sparkSettings = new SparkSettings();
builder.Configuration.Bind("SparkSettings", sparkSettings);

// Bind Store settings (includes MongoDB connection string)
var storeSettings = new StoreSettings();
builder.Configuration.Bind("StoreSettings", storeSettings);

// Bind Auth settings
var authSettings = new AuthSettings();
builder.Configuration.Bind("AuthSettings", authSettings);

// Bind feature flags
builder.Services.Configure<FeatureSettings>(builder.Configuration.GetSection("FeatureManagement"));

var forwardedHeadersSettings = new ForwardedHeadersSettings();
builder.Configuration.Bind("ForwardedHeaders", forwardedHeadersSettings);
var forwardedHeadersEnabled = forwardedHeadersSettings.KnownProxies.Count > 0
    || forwardedHeadersSettings.KnownNetworks.Count > 0;
if (forwardedHeadersEnabled)
{
    var trustedProxies = new List<IPAddress>();
    foreach (var proxy in forwardedHeadersSettings.KnownProxies)
    {
        if (!IPAddress.TryParse(proxy, out var ip))
            throw new ArgumentException(
                $"ForwardedHeaders:KnownProxies contains an invalid IP address (got '{proxy}').",
                nameof(forwardedHeadersSettings));
        trustedProxies.Add(ip);
    }
    var trustedNetworks = new List<System.Net.IPNetwork>();
    foreach (var network in forwardedHeadersSettings.KnownNetworks)
    {
        if (!System.Net.IPNetwork.TryParse(network, out var parsed))
            throw new ArgumentException(
                $"ForwardedHeaders:KnownNetworks contains an invalid CIDR network (got '{network}').",
                nameof(forwardedHeadersSettings));
        trustedNetworks.Add(parsed);
    }

    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        // XForwardedHost is omitted: with permissive AllowedHosts it would enable host-injection.
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
            | ForwardedHeaders.XForwardedProto;
        foreach (var ip in trustedProxies) options.KnownProxies.Add(ip);
        foreach (var net in trustedNetworks) options.KnownIPNetworks.Add(net);
    });
}

builder.Services
    .AddIgnisAuthServer(authSettings, useDevelopmentCertificates: !builder.Environment.IsProduction())
    .AddIgnisClientSync();

// Set up CORS policy
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin();
            policy.AllowAnyMethod();
            policy.AllowAnyHeader();
        }
        else
        {
            policy.SetIsOriginAllowed(_ => false);
            policy.AllowAnyMethod();
            policy.AllowAnyHeader();
        }
    }));

// Register MongoDB FHIR store
builder.Services.AddMongoFhirStore(storeSettings);

// Register Spark FHIR engine (also registers controllers + FHIR formatters)
builder.Services.AddFhir(sparkSettings);

// Maintenance services and operation notifications
builder.Services.AddSignalR();
builder.Services.AddSingleton<IOperationProgressNotifier, SignalROperationProgressNotifier>();
builder.Services.AddScoped<IMaintenanceService, MaintenanceService>();

builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build());

builder.Services.AddControllers();

// OpenAPI document generation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

var app = builder.Build();

app.MapOpenApi().AllowAnonymous();

// Must come before any middleware that reads request scheme/host (Serilog,
// HttpsRedirection, OAuth callback URL building, etc.).
if (forwardedHeadersEnabled)
    app.UseForwardedHeaders();

app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

await app.SyncOAuthClientsAsync();
app.MapControllers();
app.MapHub<OperationProgressHub>("/hubs/operations");
app.MapGet("/healthz", () => Results.Ok("ok")).AllowAnonymous();

app.LogStartupConfig(authSettings, forwardedHeadersSettings);

app.Run();
