# ADR-0002: Access Control for system administration

## Status

Done

## Context

Ignis needs access control for system administration: developers and operators who run data store meta-operations like migrations, index rebuilds, bulk imports/exports, and drops. The system administration tool will be an internal OAuth2/OIDC client used by a signed-in human admin.

## Suggestion

The authorization server maps each signed-in user directly to a set of allowed scopes via configuration.

### Maintenance scopes

Tokens carry scopes of the form **`maintenance/database.{read,write,destructive}`**, naming operations on the data store itself. The three levels are independent (`.write` does not imply `.read`):

- `.read` — introspection (collections, indexes, stats), bulk exports
- `.write` — index rebuilds, bulk imports, additive migrations
- `.destructive` — drops, truncations, full reset, destructive migrations

Endpoints declare which scope they require, e.g. (illustrative):

```csharp
[RequireScope("maintenance/database.write")]
public Task RebuildIndex();

[RequireScope("maintenance/database.destructive")]
public Task ResetStore();
```

### Subject identifier

The canonical subject format is **`<provider>:<provider-user-id>`** — provider name lowercased, followed by a colon and the user's stable identifier as the provider returns it.

| Provider | Source                    | Example sub  |
| -------- | ------------------------- | ------------ |
| GitHub   | numeric `id` from `/user` | `github:123` |

Prefixing keeps the subject globally unique across providers, makes audit logs self-documenting, and lets the `Users` lookup table key on a single column rather than a `(provider, id)` tuple.

### Scope assignments

User-to-scope assignments live under `AuthSettings`, starting config-driven. ADR-0001 envisions later moving these to MongoDB via claims transformation; this ADR is the simpler first step.

```jsonc
"AuthSettings": {
  "Users": [
    {
      "Subject": "github:123",
      "Scopes": [
        "maintenance/database.read",
        "maintenance/database.write",
        "maintenance/database.destructive"
      ]
    },
    {
      "Subject": "github:321",
      "Scopes": ["maintenance/database.read"]
    }
  ]
}
```

When issuing a token, the authorization server intersects the signed-in user's entry in `Users` with the scopes the client requested; the result becomes the token's `scope`, or empty (no access) if there is no match on either side.

A role layer (named bundles like `SystemAdmin`, `DatabaseOperator`) can be added later when the same scopes start repeating across many entries — token issuance would then resolve roles to scopes first, but the intersection step stays the same.

## Rationale

Direct scope assignment is the simplest model that does the job: each entry in config is one user with their explicit allow-list. There is no indirection to follow when reading the config or auditing what someone can do. We expect a handful of admins at first, so duplication is small and the audit trail is just the entry itself ("`skodde` is allowed these scopes").

The three maintenance levels mirror real blast radius: reversible read, reversible write, irreversible destruction. Splitting them gives both least-privilege separation and an explicit audit trail whenever destructive operations are used.

## Consequences

### Positive

- Destructive database operations have an explicit, auditable scope
- Config-driven and easy to evolve as more admins are added

### Negative

- No role indirection yet, so common scope bundles will be duplicated across users

## Changelog

- 2026-04-07 ([3de0a8d](https://github.com/incendilabs/ignis/commit/3de0a8d)) — Initial draft.
- 2026-04-28 (this PR) — Added _Subject identifier_ section defining the canonical `<provider>:<provider-user-id>` format; replaced the `(Provider, ProviderUserId)` tuple with a `Users` collection keyed on a prefixed `Subject`
