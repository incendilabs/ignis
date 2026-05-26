/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Text;

using FluentAssertions;

using Ignis.Api.Services.Import;

namespace Ignis.Api.Tests;

public class BoundedStreamTests
{
    private static CancellationToken CT => TestContext.Current.CancellationToken;

    [Fact]
    public async Task ReadAsync_ThrowsWhenConsumedExceedsMax()
    {
        await using var source = new MemoryStream(new byte[200]);
        await using var bounded = new BoundedStream(source, maxBytes: 100);

        var buffer = new byte[256];
        var act = async () => await bounded.ReadAsync(buffer, CT);

        await act.Should().ThrowAsync<InvalidDataException>();
    }

    [Fact]
    public async Task StreamReader_ReadToEndAsync_ThrowsWhenContentExceedsBound()
    {
        // Mirrors the production path: IngestJsonResourceAsync wraps entry.Open()
        // in a BoundedStream and reads through StreamReader.ReadToEndAsync.
        var data = Encoding.UTF8.GetBytes(new string('a', 200));
        await using var source = new MemoryStream(data);
        await using var bounded = new BoundedStream(source, maxBytes: 100);
        using var reader = new StreamReader(bounded);

        var act = async () => await reader.ReadToEndAsync(CT);

        await act.Should().ThrowAsync<InvalidDataException>();
    }

    [Fact]
    public async Task StreamReader_ReadToEndAsync_SucceedsWhenContentWithinBound()
    {
        var data = Encoding.UTF8.GetBytes("hello");
        await using var source = new MemoryStream(data);
        await using var bounded = new BoundedStream(source, maxBytes: 100);
        using var reader = new StreamReader(bounded);

        var result = await reader.ReadToEndAsync(CT);

        result.Should().Be("hello");
    }
}
