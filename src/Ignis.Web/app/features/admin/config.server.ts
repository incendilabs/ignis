/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { envBool } from "#app/env.server";
import * as authConfig from "#app/features/auth/config.server";

export function isEnabled(): boolean {
  // Admin requires both auth and the `IGNIS_WEB_FEATURES_ADMIN` feature flag
  return authConfig.isEnabled() && envBool("IGNIS_WEB_FEATURES_ADMIN", { default: false });
}
