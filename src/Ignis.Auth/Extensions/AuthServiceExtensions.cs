/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Auth.Services;

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Ignis.Auth.Extensions;

public static class AuthServiceExtensions
{
    /// <summary>
    /// Registers <see cref="ClientSyncInitializer"/> for syncing configured OAuth clients to MongoDB.
    /// Call <see cref="SyncOAuthClientsAsync"/> on the built <see cref="WebApplication"/> to run it on startup.
    /// </summary>
    public static IServiceCollection AddIgnisClientSync(
        this IServiceCollection services)
    {
        services.AddTransient<ClientSyncInitializer>();
        return services;
    }

    /// <summary>
    /// Runs the OAuth client sync on startup, ensuring configured clients exist in MongoDB.
    /// Requires <see cref="AddIgnisClientSync"/> to have been called during service registration.
    /// </summary>
    public static async Task SyncOAuthClientsAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var initializer = scope.ServiceProvider.GetRequiredService<ClientSyncInitializer>();
        await initializer.RunAsync(app.Lifetime.ApplicationStopping);
    }
}
