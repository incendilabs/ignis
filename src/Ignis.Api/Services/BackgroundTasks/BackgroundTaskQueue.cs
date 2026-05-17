/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Threading.Channels;

namespace Ignis.Api.Services.BackgroundTasks;

/// <summary>
/// Unbounded in-process queue of background work items, drained by
/// <see cref="QueuedHostedService"/>. Singleton; single reader.
/// </summary>
public sealed class BackgroundTaskQueue
{
    private readonly Channel<Func<IServiceProvider, CancellationToken, Task>> _channel =
        Channel.CreateUnbounded<Func<IServiceProvider, CancellationToken, Task>>(
            new UnboundedChannelOptions { SingleReader = true });

    public async ValueTask QueueAsync(Func<IServiceProvider, CancellationToken, Task> workItem)
    {
        ArgumentNullException.ThrowIfNull(workItem);
        await _channel.Writer.WriteAsync(workItem).ConfigureAwait(false);
    }

    public async ValueTask<Func<IServiceProvider, CancellationToken, Task>> DequeueAsync(
        CancellationToken cancellationToken) =>
        await _channel.Reader.ReadAsync(cancellationToken).ConfigureAwait(false);
}
