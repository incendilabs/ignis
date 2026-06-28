/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using MongoDB.Driver;

using Testcontainers.MongoDb;

namespace Ignis.Api.Tests;

/// <summary>
/// A single MongoDB container shared across the whole <c>IntegrationTests</c> collection. Booting a
/// container is the slow part of these tests, so every consumer reuses this one and isolates itself
/// with its own database (via <see cref="ConnectionStringForDatabase"/>) rather than starting its own.
/// </summary>
public sealed class MongoContainerFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:8").Build();

    public async ValueTask InitializeAsync() => await _mongo.StartAsync();

    /// <summary>Connection string to the shared container, scoped to <paramref name="database"/>.</summary>
    public string ConnectionStringForDatabase(string database)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(database);

        var url = new MongoUrlBuilder(_mongo.GetConnectionString()) { DatabaseName = database };
        if (string.IsNullOrWhiteSpace(url.AuthenticationSource))
            url.AuthenticationSource = "admin";
        return url.ToString();
    }

    public async ValueTask DisposeAsync() => await _mongo.DisposeAsync();
}
