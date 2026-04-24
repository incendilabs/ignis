/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { OAuthConfig } from "@eventuras/fides-auth/oauth";

import { env, envBool } from "@/env.server";

export function isEnabled(): boolean {
  return envBool("IGNIS_WEB_FEATURES_AUTH", { default: false });
}

export function oauth(): OAuthConfig {
  const appUrl = env("IGNIS_WEB_APP_URL", { default: "http://localhost:5202" });
  return {
    issuer: env("IGNIS_AUTH_ISSUER"),
    clientId: env("IGNIS_WEB_CLIENT_ID"),
    clientSecret: env("IGNIS_WEB_CLIENT_SECRET"),
    redirect_uri: `${appUrl}/auth/callback`,
    scope: "openid",
    usePar: true,
  };
}
