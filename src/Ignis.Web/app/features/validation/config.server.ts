/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { envBool } from "#app/env.server";
import * as authConfig from "#app/features/auth/config.server";
import * as resourcesConfig from "#app/features/resources-ui/config.server";

/** Available wherever the resource browser is, and on its own — no login, not even
 *  the auth feature — once the deployment opens validation up. */
export function isEnabled(): boolean {
  return resourcesConfig.isEnabled() || allowsAnonymous();
}

/** Whether visitors may validate without signing in. Only stops the bounce to login —
 *  the API's own `AllowAnonymousValidation` decides, so both sides must be set. */
export function allowsAnonymous(): boolean {
  return envBool("IGNIS_WEB_FEATURES_VALIDATION_ANONYMOUS", { default: false });
}

export type SessionRequirement = "required" | "optional" | "none";

export function sessionRequirement(): SessionRequirement {
  if (!allowsAnonymous()) return "required";
  return authConfig.isEnabled() ? "optional" : "none";
}
