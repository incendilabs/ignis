/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  // Locale-aware routes — `/admin` and `/en/admin` and `/nb/admin` all
  // resolve. Auth callbacks and healthz stay outside the prefix so the
  // OAuth client registration doesn't have to know about locale variants.
  ...prefix(":locale?", [
    // The front page keeps the plain top-navbar chrome, without the sidebar.
    layout("layouts/public.tsx", [index("routes/home.tsx")]),
    // Every page except the front page renders inside the console shell (left sidebar).
    layout("layouts/console.tsx", [
      route("user", "features/user-dashboard/routes/index.tsx"),
      route("admin/database", "features/admin/routes/database.tsx"),
      route("admin/import", "features/admin/routes/import.tsx"),
      route("admin/operations", "features/operations/routes/index.tsx"),
      route("resources", "features/resources-ui/routes/index.tsx"),
      route("resources/:resourceType", "features/resources-ui/routes/$resourceType.tsx"),
      route("resources/:resourceType/:id", "features/resources-ui/routes/$resourceType.$id.tsx"),
    ]),
    // Data-only route — no UI, so it skips the layout (and its loader).
    route("resources/:resourceType/:id/xml", "features/resources-ui/routes/$resourceType.$id.xml.tsx"),
  ]),
  // Skip i18n handling for these routes.
  route("admin/operations/stream", "features/operations/routes/stream.ts"),
  route("healthz", "routes/healthz.ts"),
  route("auth/login", "features/auth/routes/login.tsx"),
  route("auth/logout", "features/auth/routes/logout.tsx"),
  route("auth/callback", "features/auth/routes/callback.tsx"),
] satisfies RouteConfig;
