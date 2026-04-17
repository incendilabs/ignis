using Ignis.Api.Hubs;
using Ignis.Api.Services.Operations;
using Ignis.Auth;
using Ignis.Auth.Extensions;

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

builder.Services.AddControllers();

// OpenAPI document generation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

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
app.MapGet("/healthz", () => Results.Ok("ok"));

app.Run();
