# Danish profiles

> [!NOTE]
> The per-country pages are **examples**, not authoritative. Corrections and additions are very
> welcome via a GitHub issue or PR.

Add to [`fhir-packages.targets`](../../../fhir-packages.targets):

```xml
<FhirPackage Include="hl7.fhir.dk.core" Version="3.7.0" />
```

Check its dependency closure on <https://registry.fhir.org> and stage those too. See
the [validation guide](../validation.md) for the loading mechanism and Kubernetes setup.
