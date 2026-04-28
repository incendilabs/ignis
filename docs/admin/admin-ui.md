# Admin UI

System administration interface for Ignis.

## Enable the UI

Both `IGNIS_WEB_FEATURES_ADMIN` (default off) and `IGNIS_WEB_FEATURES_AUTH` must be enabled — admin access depends on the auth flow.

## Authorize a user

Admin pages require the `operations.read` scope. The BFF requests it whenever auth is enabled, and the `ignis-web` client must allow it in `appsettings.local.json`. Per-user gating ([ADR-0002](../ADR/0002-access-control-for-system-administration.md)) is not wired up yet — every user via this client gets the scope today, and the `Unauthorized` block is there for when that changes.
