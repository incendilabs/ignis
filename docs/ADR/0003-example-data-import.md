# ADR-0003: Example Data Import

## Status

Draft

## Context

Ignis needs a way to seed the server with FHIR example data, primarily for development and demos. Spark inherited this as `MaintenanceHub.LoadExamplesToStore`, which reads an embedded zip, flattens it to a `List<Resource>`, and loops `PutAsync`/`CreateAsync` per entry.

We want the seed path to sit on the same mechanism we would use for any other ingest (admin uploads), rather than being a one-off. As a concrete yardstick, we want to be able to point Ignis at a real published dataset like [smart-on-fhir/sample-bulk-fhir-datasets](https://github.com/smart-on-fhir/sample-bulk-fhir-datasets) — NDJSON files, one per resource type, split into numbered chunks — and have them load without any preprocessing.

The FHIR ecosystem has two natural shapes for moving resource sets around:

- **NDJSON** (`application/fhir+ndjson`) — the format the [Bulk Data Access IG](https://hl7.org/fhir/uv/bulkdata/export.html) standardized as the output of `$export`. One resource per line, streams, scales to large datasets.
- **Bundle JSON** (`application/fhir+json`) — the most common "one file of resources" shape. HL7 example packages, fixtures, and ad-hoc exports from other tooling typically ship this way. Bundles come in several `type` flavours (`collection`, `batch`, `transaction`) with different processing semantics.

### On the state of the spec

We have not found any normative HL7 document that defines bulk _import_ for FHIR. The Bulk Data Access IG covers `$export` only, and even that sits at **Informative / STU 3** rather than normative status.

Given that, we deliberately **align our import format with the export side of the Bulk Data Access IG** even though it is informative. Using the same format Ignis could eventually _produce_ via `$export` means data flows symmetrically. If a normative `$import` lands later, we will possibly adapt.

## Discussion

### Alternatives Considered

1. **Port Spark's zip-based loader as-is**
   - Pros: Minimal work, reuses existing `examples.zip` artifact.
   - Cons: Zip is not a standard FHIR content type. Format is Spark-specific, not reusable for admin uploads or future `$import`. Forces a separate ingest path from any other data-loading flow.

2. **NDJSON only**
   - Pros: Matches the format `$export` produces, so data exported from any Bulk-Data-compatible server can be re-imported as-is. Streams naturally, no full materialization. Inspectable and diff-friendly per line.
   - Cons: Uncommon shape for hand-curated fixture files. Forces conversion for anyone who already has a Bundle.

3. **Bundle JSON only**
   - Pros: The most common "give me a file of resources" shape in the FHIR ecosystem. One file, easy to share.
   - Cons: Doesn't match the NDJSON shape that `$export` produces, so data round-tripping through the Bulk Data ecosystem needs reformatting. Naïve parsers materialize the whole bundle in memory.

4. **Both NDJSON and Bundle JSON, routed by Content-Type**
   - Pros: Covers both common shapes without favoring one. Importer stays format-agnostic — each format is just a different `IResourceSource` yielding the same `IAsyncEnumerable<Resource>`. NDJSON stays the scalable default; Bundle JSON is the convenience path for one-off uploads and fixture files.
   - Cons: Two parsers to maintain instead of one. Marginal.

## Decision

We will support both **NDJSON** (`application/fhir+ndjson`) and **Bundle JSON** (`application/fhir+json`) as input formats, selected by `Content-Type`. NDJSON and Bundle JSON with `Bundle.type = collection` feed the generic importer; `Bundle.type = batch` and `Bundle.type = transaction` are delegated to the existing `IFhirService` transaction handling.

- A generic `FhirResourceImporter` consumes an `IAsyncEnumerable<Resource>` from any `IResourceSource`, writes through `IFhirService` (from `Spark.Engine.Service` — via `FhirController`), and reports progress via `IOperationProgressNotifier`.
- Two source implementations ship in this ADR's scope:
  - `NdjsonResourceSource` — one resource per line, streams.
  - `BundleJsonResourceSource` — parses a Bundle with `type = collection` and yields its `entry[].resource`. Bundles with `type = batch` or `type = transaction` are **not** flattened — see below.
- The seed artifact ships as **NDJSON** files embedded as resources in the API project, one per resource type (mirroring how `$export` organizes its output). Bundle JSON is supported for admin uploads and fixture files, not for the seed set.
- **Transaction and batch bundles are delegated**, not reimplemented. The import endpoint acts as a thin dispatcher: when the incoming Bundle has `type = transaction` or `type = batch`, it forwards the bundle to the same `IFhirService` transaction handling that `POST /` on `FhirController` already uses. Atomicity, `urn:uuid:` resolution, conditional references, and the FHIR-defined entry ordering come for free, because we reuse the existing implementation instead of building a parallel one. Only `type = collection` (and NDJSON) go through the `FhirResourceImporter` path.

## Consequences

### Positive

- Seed and admin upload share one code path for the flat-stream cases. Only the source implementation differs.
- NDJSON streams, so the seed path scales without bounded memory.
- Bundle JSON covers the common case of uploading a fixture file as-is.
- NDJSON is the same shape `$export` produces, so data from any Bulk-Data-compatible server round-trips through Ignis without reformatting.
- Transaction and batch bundles reuse the existing `IFhirService` transaction handling, so clients get proper atomicity and `urn:uuid:` resolution without the importer duplicating that logic.

### Negative

- One-time work to convert the existing example set to NDJSON.
- Operators bringing their own zip archives need to extract them first.
- `BundleJsonResourceSource` materializes the bundle in memory. Acceptable for admin uploads; NDJSON remains the path for scale.

### Risks

- The NDJSON seed format has no way to express `urn:uuid:` references or conditional logic, so example data that needs those must be kept as a transaction Bundle and imported through that path instead. We accept this as a constraint on the NDJSON seed set specifically, not on the import endpoint as a whole.

## References

- [FHIR Bulk Data Access IG — Export (STU 3)](https://hl7.org/fhir/uv/bulkdata/export.html)
- [FHIR NDJSON media type](https://www.hl7.org/fhir/nd-json.html)
- [FHIR Bundle processing rules](https://www.hl7.org/fhir/http.html#transaction)
- [smart-on-fhir/sample-bulk-fhir-datasets](https://github.com/smart-on-fhir/sample-bulk-fhir-datasets) — reference datasets in the target NDJSON shape
- ADR-0002: Access Control for System Administration
