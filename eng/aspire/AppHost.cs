/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

var builder = DistributedApplication.CreateBuilder(args);

var mongo = builder.AddMongoDB("mongo")
    .WithDataVolume()
    .AddDatabase("ignis");

var api = builder.AddProject<Projects.Ignis_Api>("api", launchProfileName: "https")
    .WithEnvironment("StoreSettings__ConnectionString", mongo)
    .WithEnvironment("AuthSettings__ConnectionString", mongo)
    .WaitFor(mongo);

// Fixed port, so OAuth redirect URIs in appsettings.local.json and .env keep working.
builder.AddJavaScriptApp("web", "../../src/Ignis.Web", "dev")
    .WithHttpsEndpoint(port: 5202, env: "IGNIS_WEB_DEV_PORT", isProxied: false)
    .WaitFor(api);

builder.Build().Run();
