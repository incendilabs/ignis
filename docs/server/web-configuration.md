# Web configuration

Every environment variable `Ignis.Web` (the BFF) reads.

## Required

| Variable                   | Notes                                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IGNIS_AUTH_ISSUER`        | Public URL of the authorization server (normally the API URL). Must match `AuthSettings:Issuer` on the API.                                                                                                    |
| `IGNIS_WEB_APP_URL`        | Public URL of the Web app — scheme + host[:port], no path, no trailing slash. OAuth redirect URI is built as `<IGNIS_WEB_APP_URL>/auth/callback`, which must appear in the client's `RedirectUris` on the API. |
| `IGNIS_WEB_CLIENT_ID`      | OAuth client ID registered in `Ignis.Api`. Must match an entry in `AuthSettings:Clients`.                                                                                                                      |
| `IGNIS_WEB_CLIENT_SECRET`  | Matching client secret.                                                                                                                                                                                        |
| `IGNIS_WEB_SESSION_SECRET` | 32 bytes of hex, encrypts the BFF session cookie. Generate with `openssl rand -hex 32`. **Rotating invalidates all logged-in sessions.**                                                                       |

## Optional

| Variable                  | Notes                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IGNIS_WEB_FHIR_BASE_URL` | Base URL for the FHIR API. Defaults to same-origin `/fhir/` on the Web app host; set when the API is served from a different origin.                |

## Feature flags

Both default to off. Set to `"true"` to enable.

| Variable                   | Notes                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `IGNIS_WEB_FEATURES_ADMIN` | Enables the admin UI at `/admin/*`. Requires `IGNIS_WEB_FEATURES_AUTH=true`. See [Admin UI](../admin/admin-ui.md). |
| `IGNIS_WEB_FEATURES_AUTH`  | Master switch for the OAuth/BFF login flow. Most other features require this.                                      |

## Cross-references with the API

These must agree on both sides — update API and Web together.

| Web BFF env var           | API config key                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `IGNIS_AUTH_ISSUER`       | `AuthSettings:Issuer` ([api-configuration.md](./api-configuration.md#authsettings))       |
| `IGNIS_WEB_APP_URL`       | `AuthSettings:Clients[n]:RedirectUris` (must contain `<IGNIS_WEB_APP_URL>/auth/callback`) |
| `IGNIS_WEB_CLIENT_ID`     | `AuthSettings:Clients[n]:ClientId`                                                        |
| `IGNIS_WEB_CLIENT_SECRET` | `AuthSettings:Clients[n]:ClientSecret`                                                    |
