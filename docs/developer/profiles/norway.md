# Norwegian profiles

> [!NOTE]
> The per-country pages are **examples**, not authoritative. Corrections and additions are very
> welcome via a GitHub issue or PR.

Add to [`fhir-packages.targets`](../../../fhir-packages.targets) — no dependencies
beyond `hl7.fhir.r4.core`:

```xml
<FhirPackage Include="hl7.fhir.no.basis" Version="2.2.0" />
```

Validate against one, e.g.
`?profile=http://hl7.no/fhir/StructureDefinition/no-basis-Patient`. See the
[validation guide](../validation.md) for the loading mechanism and Kubernetes setup.
