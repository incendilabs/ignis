using Ignis.Auth;
using Ignis.Auth.Extensions;
using Ignis.Auth.Services;

using Spark.Engine;
using Spark.Engine.Extensions;
using Spark.Mongo.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Bind Spark FHIR settings from configuration
var sparkSettings = new SparkSettings();
builder.Configuration.Bind("SparkSettings", sparkSettings);

// Bind Store settings (includes MongoDB connection string)
var storeSettings = new StoreSettings();
builder.Configuration.Bind("StoreSettings", storeSettings);

// Bind Auth settings (optional OAuth 2.0 server)
var authSettings = new AuthSettings();
builder.Configuration.Bind("AuthSettings", authSettings);

if (authSettings.Enabled)
{
    builder.Services.AddIgnisAuth(authSettings, builder.Environment.IsDevelopment());
}

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

// The project reference to Ignis.Auth causes auto-discovery of its controllers.
// Remove them when auth is disabled to avoid DI resolution failures.
builder.Services.AddControllers()
    .ConfigureApplicationPartManager(manager =>
    {
        if (!authSettings.Enabled)
        {
            var authAssemblyName = typeof(AuthSettings).Assembly.GetName().Name;
            var authPart = manager.ApplicationParts
                .FirstOrDefault(p => p.Name == authAssemblyName);
            if (authPart != null)
                manager.ApplicationParts.Remove(authPart);
        }
    });

// OpenAPI document generation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

var app = builder.Build();

if (authSettings.Enabled)
{
    await using var scope = app.Services.CreateAsyncScope();
    var clientSyncInitializer = scope.ServiceProvider.GetRequiredService<ClientSyncInitializer>();
    await clientSyncInitializer.RunAsync(app.Lifetime.ApplicationStopping);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseRouting();
app.UseCors();
app.MapControllers();
app.MapGet("/healthz", () => Results.Ok("ok"));

app.Run();
