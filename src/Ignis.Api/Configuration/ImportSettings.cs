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
}
