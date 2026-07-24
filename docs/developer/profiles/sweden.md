# Swedish profiles

> [!NOTE]
> The per-country pages are **examples**, not authoritative. Corrections and additions are very
> welcome via a GitHub issue or PR.

Add to [`fhir-packages.targets`](../../../fhir-packages.targets):

```xml
<FhirPackage Include="hl7se.fhir.base" Version="1.0.0" />
```

It depends on `hl7.terminology.r4` and the IPS package — stage the shared closure
from the [validation guide](../validation.md#adding-profile-packages). Canonicals are
listed on the IG homepage (<https://registry.fhir.org>).
