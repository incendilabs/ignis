# Ignis FHIR server — Bruno collection

[Bruno](https://www.usebruno.com/) requests for poking at a running Ignis FHIR
API by hand.

## Setup

1. **Open Collection** → this `eng/bruno` folder, then select the
   **ignis-local** environment.
2. Fill in `clientSecret` in the environment editor. It's a Bruno _secret
   variable_ (never committed); the dev value matches `ignis-client` in
   `appsettings.json`.
3. Disable TLS verification for the collection (self-signed dev cert).
4. Run the API, then run **Auth → Get token**: it stores `accessToken`, which
   every request sends as a Bearer header. Re-run it on 401.

## Scoped operations

Most requests need no scope. Exceptions:

| Request                            | Scope                              | Also needs             |
| ---------------------------------- | ---------------------------------- | ---------------------- |
| Maintenance → Rebuild index        | `maintenance/database.write`       | —                      |
| Maintenance → Clear store          | `maintenance/database.destructive` | `AllowClearStore` flag |
| Import → Archive import (+ limits) | `operations.import`                | `AllowImport` flag     |

The default token has no scopes, so these return `403`. To fix: add the scopes
to the `ignis-client` entry's `AllowedScopes` in `appsettings.local.json`
(otherwise the token request fails with `invalid_scope`), then add a
space-separated `scope` field to the **Get token** body and re-run it. A missing
feature flag returns `404`/`503`.

## Gotchas

- Keep `baseUrl` and `tokenUrl` on the same `https://localhost:5201` origin — an
  http→https redirect drops the `Authorization` header (→ 401).
- Bruno's built-in collection OAuth2 didn't attach the token reliably, hence the
  explicit Get token request + Bearer variable.
