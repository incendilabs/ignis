/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { OAuthConfig } from "@eventuras/fides-auth/oauth";

import { env, envBool } from "#app/env.server";
import { scopes as adminScopes } from "#app/features/admin/scopes";

export function isEnabled(): boolean {
  return envBool("IGNIS_WEB_FEATURES_AUTH", { default: false });
}

/** The application's public origin, e.g. for OAuth redirects and returnTo validation. */
export function appUrl(): string {
  return env("IGNIS_WEB_APP_URL", { default: "http://localhost:5202" });
}

export function oauth(): OAuthConfig {
  const scopes = [
    "openid",
    "profile",
    "email",
    adminScopes.operationsRead,
    adminScopes.operationsImport,
    adminScopes.maintenanceDatabaseWrite,
    adminScopes.maintenanceDatabaseDestructive,
  ];
  return {
    issuer: env("IGNIS_AUTH_ISSUER"),
    clientId: env("IGNIS_WEB_CLIENT_ID"),
    clientSecret: env("IGNIS_WEB_CLIENT_SECRET"),
    redirect_uri: `${appUrl()}/auth/callback`,
    scope: scopes.join(" "),
    usePar: true,
  };
}
