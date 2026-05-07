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
    /// Imports an archive (zip) of JSON-serialized FHIR resources.
    /// Archive parsing, extraction limits, and resource ingestion are not yet implemented.
    /// </summary>
    Task ImportArchiveAsync(Guid operationId);
}
