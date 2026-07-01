# Server setup

Operator guide for running Ignis as a self-hosted server. Walks through the order of operations and links to detailed pages for each step.

> [!IMPORTANT]
> Ignis is experimental and not intended for production use. Treat this guide as a reference for evaluation deployments.

## What you are deploying

| Service     | Role                                                               | Docs                                                |
| ----------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| `Ignis.Api` | FHIR endpoint + OAuth 2.0 / OIDC authorization server (OpenIddict) | [Ignis.Auth README](../../src/Ignis.Auth/README.md) |
| `Ignis.Web` | Browser-facing BFF (React Router) that fronts the API for users    | [Ignis.Web README](../../src/Ignis.Web/README.md)   |
| MongoDB     | Shared storage for FHIR resources and OpenIddict state             | [Infrastructure guide](../../infra/README.md)       |

OAuth flow between API and Web: [Authentication](../auth/authentication.md).

## Setup checklist

Do the steps in order — later steps assume earlier ones are in place.

| #   | Step                  | What                                                            | Reference                                                                  |
| --- | --------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Provision MongoDB     | Database used by API                                            | [Infrastructure guide](../../infra/README.md)                              |
| 2   | Decide public URLs    | One hostname for API, one for Web — they cannot share an origin | Used by `AllowedHosts`, `Issuer`, `IGNIS_WEB_APP_URL`, OAuth redirect URIs |
| 3   | Configure the API     | `AllowedHosts`, `StoreSettings`, `AuthSettings:Issuer`          | [API configuration](./api-configuration.md)                                |
| 4   | Generate certificates | PFX signing + encryption keys for OpenIddict (prod only)        | [Certificates](../../src/Ignis.Auth/README.md#certificates)                |
| 5   | Register clients      | `authorization_code` for the Web BFF; others as needed          | [Ignis.Auth README](../../src/Ignis.Auth/README.md#configuration)          |
| 6   | Wire an external IdP  | GitHub is the only built-in provider today                      | [Authenticate with GitHub](../auth/authenticate-with-github.md)            |
| 7   | Configure the Web BFF | `IGNIS_WEB_*` env vars (session, client creds, issuer, app URL) | [Web configuration](./web-configuration.md)                                |
| 8   | Trust reverse proxy   | Only if behind a proxy / load balancer / ingress                | [API config: ForwardedHeaders](./api-configuration.md#forwardedheaders)    |

> [!NOTE]
> `AuthSettings:ExternalProviders[].Type` accepts `OIDC` in config, but it is unimplemented — selecting it throws `NotSupportedException` at startup.

## Reference pages

| Page                                                            | Covers                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------ |
| [API configuration](./api-configuration.md)                     | Every config key the API reads, with env var mapping   |
| [Web configuration](./web-configuration.md)                     | Every `IGNIS_WEB_*` env var the BFF reads              |
| [Local development setup](../developer/local-dev-setup.md)          | Local API/Web HTTPS, certs, OAuth, and imports         |
| [Authentication flow](../auth/authentication.md)                | OAuth / PAR / PKCE sequence diagram                    |
| [Authenticate with GitHub](../auth/authenticate-with-github.md) | GitHub OAuth App setup                                 |
| [Ignis.Auth README](../../src/Ignis.Auth/README.md)             | Client definitions and signing certificates            |
| [Infrastructure guide](../../infra/README.md)                   | Kubernetes / Helm, TLS, Argo CD                        |
| [Admin UI](../admin/admin-ui.md)                                | Enabling the maintenance pages                         |
| [Scopes](../admin/scopes.md)                                    | Every OAuth scope and how user/client assignment works |
