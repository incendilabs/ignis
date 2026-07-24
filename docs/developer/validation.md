# Validation and FHIR Profiles

How `$validate` works in Ignis, and how to add profile packages. Ignis by default targets
European IGs (HL7 Europe, IPS); national profiles are opt-in — see
[Norway](profiles/norway.md), [Sweden](profiles/sweden.md), [Denmark](profiles/denmark.md).

> [!NOTE]
> The per-country pages are **examples**, not authoritative. Corrections and additions are very
> welcome via a GitHub issue or PR.

## Profiles

A FHIR **profile** is a `StructureDefinition` that constrains a base resource type:
which elements are required, which terminologies are allowed, which extensions exist.
`no-basis-Patient` says what a Norwegian Patient must look like; the HL7 Europe base
profiles say the same at the European level.

## How `$validate` works

`POST /fhir/{type}/$validate` validates the body and returns an `OperationOutcome`.
The profile is chosen in order: `?profile=<canonical>`, then the resource's
`meta.profile`, then the base resource type.

A malformed body (invalid codes, wrong structure) is rejected with a **400** by the
strict input formatter before validation runs — so `$validate` reports profile
findings only on resources that already parse.

Canonicals resolve **package-first, store-fallback**: staged packages first, then
`StructureDefinition`s you `PUT` into the FHIR store — so draft profiles need no
package at all.

## Adding profile packages

Profiles ship as `.tgz` **packages** declared in
[`fhir-packages.targets`](../../fhir-packages.targets); the build stages each one and
the API loads every `.tgz` at startup. Add the package **and its full dependency
closure** — dependencies are _not_ resolved automatically (each package's registry
page lists them):

```xml
<ItemGroup>
  <FhirPackage Include="hl7.fhir.r4.core" Version="4.0.1" />
  <FhirPackage Include="hl7.fhir.eu.base" Version="2.0.0" />
  <FhirPackage Include="hl7.fhir.uv.ips" Version="1.1.0" />
  <!-- shared closure for the two IGs above -->
  <FhirPackage Include="hl7.terminology.r4" Version="7.1.0" />
  <FhirPackage Include="hl7.fhir.uv.extensions.r4" Version="5.2.0" />
  <FhirPackage Include="hl7.fhir.eu.extensions.r4" Version="1.3.0" />
  <FhirPackage Include="hl7.fhir.uv.xver-r5.r4" Version="0.1.0" />
  <FhirPackage Include="fhir.dicom" Version="2022.4.20221006" />
  <FhirPackage Include="ihe.pharm.mpd.r4" Version="1.0.0-comment-2" />
</ItemGroup>
```

Find ids and current versions on the IG homepage or <https://registry.fhir.org>
(the ones above were verified against packages.fhir.org, July 2026). **One version
per package** — the loader reads every `.tgz`, so when IGs disagree on a shared
dependency stage only the highest (terminology/extension packages are additive).
**R4 only.**

## Local development

With `dotnet run`, packages from `fhir-packages.targets` are staged into the build and
loaded at startup — so locally, just add one there and rebuild.

To load a prebuilt folder of `.tgz` instead — it must hold the **full** set, including
`hl7.fhir.r4.core` — point `appsettings.local.json` at it:

```json
{ "ProfileValidationSettings": { "PackageDirectory": "/tmp/fhir-packages" } }
```

Or mount that folder when running the API image:
`docker run -v /tmp/fhir-packages:/fhir-packages -e ProfileValidationSettings__PackageDirectory=/fhir-packages …`

## Kubernetes: add packages without rebuilding

List them under `app.api.fhirPackages.packages`; an init container downloads each
into a volume seeded with the image's built-in packages (name the full closure — it
fetches exactly what you list, nothing transitively):

```sh
helm upgrade --install ignis infra/helm \
  --set 'app.api.fhirPackages.packages[0]=hl7.fhir.eu.base@2.0.0'
```

For air-gapped clusters, mount a `.tgz` volume via `extraVolumes`/`extraVolumeMounts`
and point the API at it with
`extraEnv: [{name: ProfileValidationSettings__PackageDirectory, value: /your/mount}]`.
See [ProfileValidationSettings](../server/api-configuration.md#profilevalidationsettings).
