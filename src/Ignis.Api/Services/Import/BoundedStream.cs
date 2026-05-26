/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Services.Import;

/// <summary>
/// Read-only wrapper that throws <see cref="InvalidDataException"/> as soon as
/// more than <c>maxBytes</c> have been read from the inner stream. Defends
/// against zip-bombs and other size-metadata-lies where the source advertises
/// a small uncompressed length but actually decompresses much more.
/// </summary>
internal sealed class BoundedStream : Stream
{
    private readonly Stream _inner;
    private readonly long _maxBytes;
    private long _consumed;

    public BoundedStream(Stream inner, long maxBytes)
    {
        ArgumentNullException.ThrowIfNull(inner);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxBytes);
        _inner = inner;
        _maxBytes = maxBytes;
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        var n = _inner.Read(buffer, offset, count);
        _consumed += n;
        ThrowIfExceeded();
        return n;
    }

    public override async ValueTask<int> ReadAsync(
        Memory<byte> buffer, CancellationToken cancellationToken = default)
    {
        var n = await _inner.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
        _consumed += n;
        ThrowIfExceeded();
        return n;
    }

    private void ThrowIfExceeded()
    {
        if (_consumed > _maxBytes)
            throw new InvalidDataException(
                $"Stream exceeded the configured limit of {_maxBytes} bytes.");
    }

    public override bool CanRead => _inner.CanRead;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position
    {
        get => _consumed;
        set => throw new NotSupportedException();
    }
    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}
