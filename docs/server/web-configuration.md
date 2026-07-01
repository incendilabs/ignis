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

## Local dev server

These are read by `src/Ignis.Web/vite.config.ts` and `src/Ignis.Web/react-router.config.ts` during local development.

| Variable                               | Notes                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `IGNIS_WEB_DEV_PORT`                   | Vite dev server port. Defaults to `5202`.                                                        |
| `IGNIS_WEB_DEV_HTTPS`                  | Set to `"true"` to serve Web over HTTPS locally.                                                 |
| `IGNIS_WEB_DEV_HTTPS_KEY`              | Path to the local HTTPS key file, relative to `src/Ignis.Web/vite.config.ts` or absolute.        |
| `IGNIS_WEB_DEV_HTTPS_CERT`             | Path to the local HTTPS cert file, relative to `src/Ignis.Web/vite.config.ts` or absolute.       |
| `IGNIS_WEB_DEV_ALLOWED_HOSTS`          | Comma-separated Vite allowed hosts for dev-server requests.                                      |
| `IGNIS_WEB_DEV_ALLOWED_ACTION_ORIGINS` | Comma-separated hosts allowed to submit React Router actions. Include host and port, no scheme.  |

See [Local Development Setup](../developer/local-dev-setup.md) for a complete local setup.

## Feature flags

All default to off. Set to `"true"` to enable.

| Variable                          | Notes                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `IGNIS_WEB_FEATURES_ADMIN`        | Enables the admin UI at `/admin/*`. Requires `IGNIS_WEB_FEATURES_AUTH=true`. See [Admin UI](../admin/admin-ui.md). |
| `IGNIS_WEB_FEATURES_AUTH`         | Master switch for the OAuth/BFF login flow. Most other features require this.                                      |
| `IGNIS_WEB_FEATURES_OPERATIONS`   | Enables the operations log at `/admin/operations`. Requires `IGNIS_WEB_FEATURES_ADMIN=true`.                       |
| `IGNIS_WEB_FEATURES_RESOURCES_UI` | Enables the resource browser at `/resources`. Requires `IGNIS_WEB_FEATURES_AUTH=true`.                             |

## Cross-references with the API

These must agree on both sides — update API and Web together.

| Web BFF env var           | API config key                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `IGNIS_AUTH_ISSUER`       | `AuthSettings:Issuer` ([api-configuration.md](./api-configuration.md#authsettings))       |
| `IGNIS_WEB_APP_URL`       | `AuthSettings:Clients[n]:RedirectUris` (must contain `<IGNIS_WEB_APP_URL>/auth/callback`) |
| `IGNIS_WEB_CLIENT_ID`     | `AuthSettings:Clients[n]:ClientId`                                                        |
| `IGNIS_WEB_CLIENT_SECRET` | `AuthSettings:Clients[n]:ClientSecret`                                                    |
