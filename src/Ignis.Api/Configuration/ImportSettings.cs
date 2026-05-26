/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Configuration;

/// <summary>
/// Settings for archive import; bound from the <c>ImportSettings</c>
/// configuration section.
/// </summary>
public sealed class ImportSettings
{
    /// <summary>
    /// Max upload size for <c>$archive-import</c> in bytes. Applied per-request
    /// via <c>ImportRequestSizeLimitFilter</c>; opts up from the global
    /// Kestrel default. Default 50 MiB.
    /// </summary>
    public long MaxUploadSizeBytes { get; set; } = 50 * 1024 * 1024;

    /// <summary>
    /// Zip-bomb guard: sum of <c>ZipArchiveEntry.Length</c> across all entries.
    /// Above this, the request is rejected synchronously with 413 before
    /// queuing. Default 500 MiB.
    /// </summary>
    public long MaxArchiveUncompressedBytes { get; set; } = 500 * 1024 * 1024;

    /// <summary>
    /// Per-entry uncompressed size cap. Enforced via <c>ZipArchiveEntry.Length</c>
    /// metadata and again at read time via <c>BoundedStream</c> (defence against
    /// metadata that lies). Oversize entries are skipped; the rest of the archive
    /// continues. Default 50 MiB.
    /// </summary>
    public long MaxEntryUncompressedBytes { get; set; } = 50 * 1024 * 1024;
}
