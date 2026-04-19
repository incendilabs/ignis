using Ignis.Api.Configuration;
using Ignis.Api.Hubs;
using Ignis.Api.Services.Operations;
using Ignis.Auth;
using Ignis.Auth.Extensions;

using Microsoft.AspNetCore.Authorization;

using OpenIddict.Validation.AspNetCore;

using Serilog;

using Spark.Engine;
using Spark.Engine.Extensions;
using Spark.Mongo.Extensions;

var builder = WebApplication.CreateBuilder(args);

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

builder.Services
    .AddIgnisAuthServer(authSettings, builder.Environment.IsDevelopment())
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

app.UseSerilogRequestLogging();
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

await app.SyncOAuthClientsAsync();
app.MapControllers();
app.MapHub<OperationProgressHub>("/hubs/operations");
app.MapGet("/healthz", () => Results.Ok("ok")).AllowAnonymous();

app.Run();
