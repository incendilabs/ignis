/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { scopes } from "./scopes";

/** FHIR operation that ingests a ZIP archive of resources. */
export const archiveImportEndpoint = "$archive-import";

/** Multipart form field the API reads the uploaded archive from. */
export const archiveImportFileField = "file";

/** OAuth scope required to trigger an import. */
export const archiveImportScope = scopes.operationsImport;

/**
 * Fallback upload limit used when the API's configured limit can't be read.
 * Mirrors the API's default `ImportSettings.MaxUploadSizeBytes` (50 MiB).
 */
export const archiveImportMaxUploadBytesFallback = 50 * 1024 * 1024;

/** Formats a byte count as megabytes, e.g. `52428800` → `"50 MB"`. */
export function formatMegabytes(bytes: number): string {
  return `${String(Math.round(bytes / (1024 * 1024)))} MB`;
}

/** Accepted file types for the archive picker (ZIP only). */
export const archiveImportAcceptedTypes = [
  "application/zip",
  "application/x-zip-compressed",
  ".zip",
];

export { type OperationResult } from "./maintenance.shared";
