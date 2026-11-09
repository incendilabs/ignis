# Ignis.Codegen

> [!IMPORTANT]
> The codegen part of Ignis is also an experimental part.

Generates the TypeScript types in `src/Ignis.Web/app/lib/fhir/generated/<version>/` from FHIR packages, using the Firely SDK for package resolution and snapshot generation. `extensions.ts` imports `ExtensionDefinition` from `../../model`, so the output belongs two levels below `lib/fhir`.

```sh
# Every resource of every version: fhir-packages/<version>/ -> generated/<version>/
dotnet run --project src/Ignis.Codegen -- --packages fhir-packages --out src/Ignis.Web/app/lib/fhir/generated [--force]

# Selected definitions from one package folder (extensions resolve against the core package in it)
dotnet run --project src/Ignis.Codegen -- --packages fhir-packages/r4 --out /tmp/out \
  Patient Questionnaire http://hl7.no/fhir/StructureDefinition/no-basis-middlename
```

Building the project downloads one core package per version into `fhir-packages/<version>/` (the
`FhirCodegenPackage` list in `fhir-packages.targets`). R6 comes from packages2.fhir.org.

Per version the generator writes:

- `types.ts`: one interface per resource or datatype. Backbone elements become `OwnerPath` interfaces
  (`QuestionnaireItemEnableWhen`), `[x]` expands per type, primitives get a `_name?: Element` sibling,
  `min: 1` makes a field required, abstract resources get `resourceType: string`.
- `index.ts`: re-exports plus `AnyResource`, `ResourceType`, `resourceTypes` and `fhirVersion`.
- `extensions.ts` when extension definitions were requested: a typed interface (literal `url`, allowed
  `value[x]` fields, typed slices for complex extensions) and an `ExtensionDefinition` constant with
  `url`, `context` and `valueTypes`. The runtime side (`ExtensionDefinition`, `getExtension`) is a
  separate change in `lib/fhir/model`; the default run generates core types only.
