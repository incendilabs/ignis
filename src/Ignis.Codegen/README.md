# Ignis.Codegen

> [!IMPORTANT]
> Experimental.

Generates TypeScript interfaces for FHIR resources and datatypes, plus typed extension definitions, from
the official FHIR packages. Firely handles package resolution and snapshots. Output goes to
`src/Ignis.Web/app/lib/fhir/generated/<version>/` and is git-ignored.

## Usage

```sh
# Every resource of every version
dotnet run --project src/Ignis.Codegen -- --packages fhir-packages --out src/Ignis.Web/app/lib/fhir/generated [--force]

# Selected definitions (type name or canonical) from one version
dotnet run --project src/Ignis.Codegen -- --packages fhir-packages/r4 --out /tmp/out \
  Patient http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl
```

Exit codes: `0` ok, `1` some definitions failed, `2` usage error.

## Features

- TypeScript interfaces for every resource in the R4, R4B, R5 and R6 core packages, and for the datatypes they use.
- Backbone elements, `[x]` choice types, `contentReference`, and `_name` siblings for primitives.
- An `AnyResource` union that narrows on `resourceType`, plus `ResourceType` and `resourceTypes` for
  runtime checks.
- Typed extensions with `ExtensionDefinition` constants for `getExtension` (selected mode only).

## Inputs

One core package per FHIR version, listed as `FhirCodegenPackage` in `fhir-packages.targets`. They are
downloaded when the project is built.

| Folder               | Package             | Version         |
| -------------------- | ------------------- | --------------- |
| `fhir-packages/r4/`  | `hl7.fhir.r4.core`  | 4.0.1           |
| `fhir-packages/r4b/` | `hl7.fhir.r4b.core` | 4.3.0           |
| `fhir-packages/r5/`  | `hl7.fhir.r5.core`  | 5.0.0           |
| `fhir-packages/r6/`  | `hl7.fhir.r6.core`  | 6.0.0-snapshot1 |

## Output

For each version:

- `types.ts`: one interface per resource, datatype and backbone element, plus every type they reference.
- `index.ts`: re-exports, `fhirVersion`, `AnyResource`, `ResourceType` and `resourceTypes`.
- `extensions.ts`: only when extensions are requested. It imports `ExtensionDefinition` from
  `../../model`, so the output must sit two levels below `lib/fhir`.

## Mapping

| FHIR                         | TypeScript                                                        |
| ---------------------------- | ----------------------------------------------------------------- |
| Concrete / abstract resource | `resourceType: "Patient"` / `resourceType: string`                |
| `min ≥ 1`                    | required property                                                 |
| `max` > 1 or `*`             | `T[]`                                                             |
| Backbone element             | its own interface named by path: `QuestionnaireItemEnableWhen`    |
| `contentReference`           | reuses the referenced interface                                   |
| `value[x]`                   | one optional property per type: `valueString`, `valueCoding`, …   |
| Primitive                    | `boolean`, `number` or `string`, plus a `_name?: Element` sibling |
| Slices                       | ignored                                                           |

Interfaces are flat (no `extends`), so inherited elements are repeated in each one.

## Extensions

For each requested extension, `extensions.ts` gets two things:

- An **interface** for the extension's shape in FHIR JSON. `url` is fixed to the extension's canonical
  URL, and only the allowed `value[x]` fields are included.
- A **constant** with the same information at runtime (`url`, `context`, `valueTypes`). The helpers in
  `lib/fhir/model` use it to find the extension.

Example for `questionnaire-itemControl`:

```ts
export interface ItemControlExtension extends Extension {
  url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl";
  valueCodeableConcept: CodeableConcept;
}

export const ItemControl: ExtensionDefinition<ItemControlExtension> = {
  url: "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl",
  context: ["Questionnaire.item", "Questionnaire.item.item"],
  valueTypes: ["CodeableConcept"],
};
```

Passing the constant to `findExtension` returns the typed interface, so the value can be read without
casts:

```ts
const control = findExtension(item, ItemControl); // ItemControlExtension | undefined
const code = control?.valueCodeableConcept.coding?.[0]?.code;
```

Rules:

- The names come from `StructureDefinition.name` in PascalCase: the interface gets an `Extension`
  suffix, the constant does not.
- A `value<Type>` field is required only when `value[x]` is required and allows exactly one type.
- A complex extension (one with sub-extensions) has no value. It gets one interface per sub-extension,
  and its `extension` field is an array of those.

## Re-runs and errors

A `.stamp` file per version skips generation when the packages and the generator are unchanged.
`--force` regenerates anyway. A definition that fails is reported as `FAILED <canonical>: <reason>`,
and the rest of the output is still written.

## Build and tests

- `npm run dev`, `build` and `typecheck` run `fhir:generate` first, so Ignis.Web needs the .NET SDK.
- The Docker image has no .NET. The types are generated on the host before `docker build`.
- `tests/Ignis.Codegen.Tests` checks the R4 output for `Patient`, `Questionnaire` and an extension.
