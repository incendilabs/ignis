# `$archive-import`

Async endpoint for ingesting a zip of FHIR JSON resources. The upload is buffered, validated, queued for background ingestion, and progress is reported via the operations hub.

## Request

`POST /fhir/$archive-import` — `multipart/form-data` with a `file` part. Requires the `operations.import` scope (see [scopes.md](scopes.md)) and `FeatureManagement:AllowImport=true`.

Status codes are described in the generated OpenAPI document at `/openapi/v1.json`.

## Configuration

| Key                                          | Default                | Notes                                              |
| -------------------------------------------- | ---------------------- | -------------------------------------------------- |
| `FeatureManagement:AllowImport`              | `false`                | Master enable                                      |
| `ImportSettings:MaxUploadSizeBytes`          | `52428800` (50 MiB)    | Compressed upload cap; enforced per request        |
| `ImportSettings:MaxArchiveUncompressedBytes` | `524288000` (500 MiB)  | Sum of `entry.Length`; rejected with 413           |
| `ImportSettings:MaxEntryUncompressedBytes`   | `52428800` (50 MiB)    | Per-entry cap; oversize entries skipped and logged |
