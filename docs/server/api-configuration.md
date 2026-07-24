# API configuration

## Sources and precedence

Later sources override earlier ones.

| Order | Source                   | Scope                                                                                          |
| ----- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| 1     | `appsettings.json`       | Committed defaults — [src/Ignis.Api/appsettings.json](../../src/Ignis.Api/appsettings.json)    |
| 2     | `appsettings.local.json` | `Development` only, gitignored — [example](../../src/Ignis.Api/appsettings.local.example.json) |
| 3     | `dotnet user-secrets`    | `Development` only                                                                             |
| 4     | Environment variables    | Recommended for production                                                                     |
| 5     | Command-line arguments   | Ad-hoc overrides                                                                               |

### JSON → env var translation

Replace `:` with `__` (double underscore); array indices are their own segment.

| JSON path                         | Env var                              |
| --------------------------------- | ------------------------------------ |
| `AllowedHosts`                    | `AllowedHosts`                       |
| `StoreSettings:ConnectionString`  | `StoreSettings__ConnectionString`    |
| `AuthSettings:Clients:0:ClientId` | `AuthSettings__Clients__0__ClientId` |
| `ForwardedHeaders:KnownProxies:0` | `ForwardedHeaders__KnownProxies__0`  |

## AllowedHosts

Host-header allow-list. The committed [appsettings.json](../../src/Ignis.Api/appsettings.json) ships `localhost`; [HostFilteringExtensions.cs](../../src/Ignis.Api/Configuration/HostFilteringExtensions.cs) raises `MissingConfigurationException` if a deploy overrides it to empty (the ASP.NET implicit fallback to `"*"` is deliberately disabled).

| Key            | Required | Default     | Format / notes                                                  |
| -------------- | -------- | ----------- | --------------------------------------------------------------- |
| `AllowedHosts` | yes      | `localhost` | Semicolon-separated hostnames. Use `"*"` to opt out explicitly. |

## StoreSettings

MongoDB connection for the FHIR store (resources, history).

| Key                              | Required | Default                           | Notes                          |
| -------------------------------- | -------- | --------------------------------- | ------------------------------ |
| `StoreSettings:ConnectionString` | yes      | `mongodb://localhost:27017/ignis` | MongoDB URI with database name |

## AuthSettings

OAuth 2.0 / OIDC authorization server (OpenIddict). May share or split the MongoDB database with `StoreSettings`. See [Ignis.Auth README](../../src/Ignis.Auth/README.md) and [Authentication](../auth/authentication.md).

| Key                                        | Required  | Notes                                                                                                 |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------- |
| `AuthSettings:ConnectionString`            | yes       | MongoDB URI for OpenIddict state (clients, tokens, authorizations)                                    |
| `AuthSettings:Issuer`                      | prod      | Absolute public URL in OIDC discovery. Set when behind a TLS-terminating proxy.                       |
| `AuthSettings:RefreshTokenLifetimeSeconds` | optional  | Absolute refresh token lifetime before re-login; default `28800` (8 h).                               |
| `AuthSettings:Clients[]`                   | yes       | Registered OAuth clients — [Ignis.Auth → Configuration](../../src/Ignis.Auth/README.md#configuration) |
| `AuthSettings:ExternalProviders[]`         | for login | External identity providers — [Authenticate with GitHub](../auth/authenticate-with-github.md)         |
| `AuthSettings:Users[]`                     | optional  | Per-user scope assignments — subject format and scope semantics in [Scopes](../admin/scopes.md)       |
| `AuthSettings:Certificates:*`              | prod      | Signing + encryption PFX — [Ignis.Auth → Certificates](../../src/Ignis.Auth/README.md#certificates)   |
| `AuthSettings:Endpoints:LoginPath`         | optional  | Override the login challenge path (default `connect/login`)                                           |

> [!NOTE]
> `ExternalProviders[].Type` accepts `GitHub` or `OIDC` — but `OIDC` is unimplemented and throws `NotSupportedException` at startup.

## ForwardedHeaders

Trusted-proxy allow-list for `X-Forwarded-For` / `X-Forwarded-Proto`. Required when behind a reverse proxy, load balancer, or ingress. Middleware only registers when at least one proxy or network is configured; invalid values fail fast with `InvalidConfigurationException`.

| Key                              | Type                 | Example          | Notes                                |
| -------------------------------- | -------------------- | ---------------- | ------------------------------------ |
| `ForwardedHeaders:KnownProxies`  | list of IP strings   | `["10.0.0.1"]`   | Individual IPv4/IPv6 proxy addresses |
| `ForwardedHeaders:KnownNetworks` | list of CIDR strings | `["10.0.0.0/8"]` | Trusted proxy networks               |

| Header              | Trusted?  | Reason                                                               |
| ------------------- | --------- | -------------------------------------------------------------------- |
| `X-Forwarded-For`   | yes       | Restores client IP                                                   |
| `X-Forwarded-Proto` | yes       | Restores scheme behind TLS terminators                               |
| `X-Forwarded-Host`  | **never** | With permissive `AllowedHosts` it would enable host-header injection |

## FeatureManagement

Boolean gates for endpoints that are off by default. Defense-in-depth on top of the corresponding `maintenance/*` scopes.

| Key                                 | Default | When `true`                                                | When `false`              |
| ----------------------------------- | ------- | ---------------------------------------------------------- | ------------------------- |
| `FeatureManagement:AllowClearStore` | `false` | `$clear-store` is reachable (still requires `destructive`) | `$clear-store` → `404`    |
| `FeatureManagement:AllowImport`     | `false` | `$archive-import` is reachable                             | `$archive-import` → `503` |

## SparkSettings

Spark FHIR engine. Defaults in [appsettings.json](../../src/Ignis.Api/appsettings.json) are usually fine.

| Key                         | Notes                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `SparkSettings:Endpoint`    | Base URL Spark embeds in resource `fullUrl` / `Bundle.link`. Match the public API URL. |
| `SparkSettings:FhirRelease` | `R4` (only release currently used)                                                     |

## ProfileValidationSettings

FHIR conformance packages the structural profile validator loads for `$validate`. The directory is scanned (non-recursively) for `*.tgz` packages; empty uses the build-staged [`fhir-packages`](../../fhir-packages.targets) folder, and a relative value resolves under the app base directory. Dependencies are **not** fetched at run time — every transitive package must already be present. In Kubernetes, add packages without rebuilding the image via `app.api.fhirPackages.packages` (an init container downloads them), or set this directly to an air-gapped mount; see the [validation guide](../developer/validation.md#kubernetes-without-rebuilding-the-image). Point it at an empty directory to turn validation off (no packages load; `$validate` resolves nothing).

| Key                                          | Required | Default | Notes                    |
| -------------------------------------------- | -------- | ------- | ------------------------ |
| `ProfileValidationSettings:PackageDirectory` | no       | empty   | PVC mount in Kubernetes. |

## Serilog

Console logging. Defaults emit human-readable output; switch to compact JSON for log aggregators.

| Env var                                | Value                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| `Serilog__WriteTo__0__Name`            | `Console`                                                                             |
| `Serilog__WriteTo__0__Args__formatter` | `Serilog.Formatting.Compact.RenderedCompactJsonFormatter, Serilog.Formatting.Compact` |

See also [root README → Structured JSON logging](../../README.md#structured-json-logging).
