# Ignis.AppHost

Optional [Aspire](https://aspire.dev) AppHost that runs the whole stack locally. For local development only, not for deployment; deployments use the [Helm chart](../../infra/helm/README.md).

## What it starts

| Resource | Notes |
| --- | --- |
| `mongo` | MongoDB container with a persistent data volume. Its connection string is injected into the API as `StoreSettings__ConnectionString` and `AuthSettings__ConnectionString`. |
| `api` | `Ignis.Api` with the `https` launch profile, on `https://localhost:5201`. |
| `web` | `Ignis.Web` via `npm run dev`, on `https://localhost:5202`. |

Ports are the same as in the [local development setup](../../docs/developer/local-dev-setup.md), so OAuth redirect URIs keep working.

## Prerequisites

- Docker (or another container runtime Aspire supports).
- The local setup from [local-dev-setup.md](../../docs/developer/local-dev-setup.md): dev certificates, `src/Ignis.Api/appsettings.local.json` and `src/Ignis.Web/.env`. The AppHost reads those as usual; it only adds the MongoDB connection.
- Optional: the Aspire CLI (`aspire`).

## Run

```bash
aspire run
```

or without the CLI:

```bash
dotnet run --project eng/aspire
```

The dashboard runs at `https://localhost:17096`; the login link with a fresh token is printed on startup. Stop any API or Web you already run on 5201/5202 first.

## Notes

- Environment variables override `appsettings.local.json`, so a connection string there is ignored under the AppHost.
- The MongoDB container is separate from a `docker run` Mongo on 27017; data does not carry over.
- The API logs via Serilog to the console, which the dashboard shows. Traces and metrics need OpenTelemetry, which is not wired up yet.
