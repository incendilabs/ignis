# Scopes

Reference for every OAuth scope the Ignis authorization server recognises. Source of truth for the canonical names is [`KnownScopes.cs`](../../src/Ignis.Auth/Authorization/KnownScopes.cs); this page documents the operational meaning.

## Recognised scopes

| Scope                              | Domain      | Purpose                                                             |
| ---------------------------------- | ----------- | ------------------------------------------------------------------- |
| `openid`                           | OIDC        | Standard OpenID Connect — required to receive an ID token           |
| `profile`                          | OIDC        | Standard OIDC profile claims (`name`, `picture`)                    |
| `email`                            | OIDC        | Standard OIDC email claim                                           |
| `operations.read`                  | Operations  | Observe long-running operations (admin UI, progress hub)            |
| `operations.import`                | Operations  | Trigger import operations (`$archive-import`)                       |
| `maintenance/database.read`        | Maintenance | Read-only introspection (collections, indexes, stats), bulk exports |
| `maintenance/database.write`       | Maintenance | Index rebuilds, bulk imports, additive migrations                   |
| `maintenance/database.destructive` | Maintenance | Drops, truncations, full reset, destructive migrations              |

The three maintenance levels are **independent** — `.write` does not imply `.read`.

## Subject identifier

Each authenticated user has a canonical subject of the form `<provider>:<provider-user-id>`. The provider name is lowercased; the user id is whatever stable identifier the provider returns.

| Provider | Source                    | Example subject |
| -------- | ------------------------- | --------------- |
| GitHub   | numeric `id` from `/user` | `github:123456` |

## Granting scopes to a user

Two configuration sections gate what scopes a logged-in user actually receives:

| Config key                              | Role                                            |
| --------------------------------------- | ----------------------------------------------- |
| `AuthSettings:Clients[n]:AllowedScopes` | Maximum set the client may ever request         |
| `AuthSettings:Users[n].Scopes`          | Per-user allow-list, keyed by canonical subject |

The token's scopes are the **intersection** of (a) what the client requested, (b) the client's `AllowedScopes`, and (c) the user's `Scopes`. A scope appears in the issued token only if it is present in all three.

### Example

```json
"AuthSettings": {
  "Clients": [
    {
      "ClientId": "ignis-web",
      "AllowedScopes": ["openid", "profile", "email", "operations.read", "maintenance/database.write"]
    }
  ],
  "Users": [
    {
      "Subject": "github:123456",
      "Scopes": ["openid", "profile", "email", "operations.read"]
    }
  ]
}
```
