/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Services.Import;

/// <summary>
/// Imports FHIR resources into the data store. Each method takes an opaque
/// <c>operationId</c> that progress notifications are tagged with so callers
/// (and downstream subscribers) can correlate updates to a specific run.
/// </summary>
public interface IImportService
{
    /// <summary>
    /// Reads a zip archive and reports the number of entries it contains via
    /// the operations hub. Resource parsing and ingestion are out of scope for
    /// the current slice; later slices will extend the implementation.
    /// </summary>
    Task ImportZipArchiveAsync(Guid operationId, Stream archive);
}
