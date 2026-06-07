/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { type RouteConfig, index, prefix, route } from "@react-router/dev/routes";

export default [
  // Locale-aware routes — `/admin` and `/en/admin` and `/nb/admin` all
  // resolve. Auth callbacks and healthz stay outside the prefix so the
  // OAuth client registration doesn't have to know about locale variants.
  ...prefix(":locale?", [
    index("routes/home.tsx"),
    route("admin", "features/admin/routes/index.tsx"),
    route("admin/operations", "features/operations/routes/index.tsx"),
    route("resources", "features/resources-ui/routes/index.tsx"),
    route("resources/:resourceType", "features/resources-ui/routes/$resourceType.tsx"),
    route("resources/:resourceType/:id", "features/resources-ui/routes/$resourceType.$id.tsx"),
  ]),
  route("healthz", "routes/healthz.ts"),
  route("auth/login", "features/auth/routes/login.tsx"),
  route("auth/callback", "features/auth/routes/callback.tsx"),
] satisfies RouteConfig;
