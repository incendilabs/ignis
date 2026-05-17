/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Ignis.Api.Services.BackgroundTasks;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ignis.Api.Tests;

public class BackgroundTaskQueueTests
{
    private static CancellationToken CT => TestContext.Current.CancellationToken;

    private static IHost BuildHost(Action<IServiceCollection>? configure = null)
    {
        var builder = Host.CreateApplicationBuilder();
        builder.Logging.ClearProviders();
        builder.Services.AddSingleton<BackgroundTaskQueue>();
        builder.Services.AddHostedService<QueuedHostedService>();
        configure?.Invoke(builder.Services);
        return builder.Build();
    }

    [Fact]
    public async Task QueuedWorkItem_Runs()
    {
        var ran = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        using var host = BuildHost();
        await host.StartAsync(CT);
        try
        {
            var queue = host.Services.GetRequiredService<BackgroundTaskQueue>();
            await queue.QueueAsync((_, _) =>
            {
                ran.TrySetResult();
                return Task.CompletedTask;
            });

            await ran.Task.WaitAsync(TimeSpan.FromSeconds(5), CT);
        }
        finally
        {
            await host.StopAsync(CT);
        }
    }

    [Fact]
    public async Task QueuedWorkItem_ResolvesScopedService()
    {
        var resolved = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);

        using var host = BuildHost(services => services.AddScoped<TestScopedMarker>());
        await host.StartAsync(CT);
        try
        {
            var queue = host.Services.GetRequiredService<BackgroundTaskQueue>();
            await queue.QueueAsync((sp, _) =>
            {
                var marker = sp.GetRequiredService<TestScopedMarker>();
                resolved.TrySetResult(marker.Id);
                return Task.CompletedTask;
            });

            var id = await resolved.Task.WaitAsync(TimeSpan.FromSeconds(5), CT);
            id.Should().NotBeNullOrEmpty();
        }
        finally
        {
            await host.StopAsync(CT);
        }
    }

    [Fact]
    public async Task FailingWorkItem_DoesNotKillTheService()
    {
        var secondRan = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        using var host = BuildHost();
        await host.StartAsync(CT);
        try
        {
            var queue = host.Services.GetRequiredService<BackgroundTaskQueue>();
            await queue.QueueAsync((_, _) => throw new InvalidOperationException("boom"));
            await queue.QueueAsync((_, _) =>
            {
                secondRan.TrySetResult();
                return Task.CompletedTask;
            });

            await secondRan.Task.WaitAsync(TimeSpan.FromSeconds(5), CT);
        }
        finally
        {
            await host.StopAsync(CT);
        }
    }

    private sealed class TestScopedMarker
    {
        public string Id { get; } = Guid.NewGuid().ToString();
    }
}
