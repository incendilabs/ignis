/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { envBool } from "#app/env.server";
import * as authConfig from "#app/features/auth/config.server";

export function isEnabled(): boolean {
  // Resource browser is available to any authenticated user (clinicians,
  // admins, etc.). Requires auth plus its own IGNIS_WEB_FEATURES_RESOURCES_UI
  // flag so it can be rolled out independently.
  return authConfig.isEnabled() && envBool("IGNIS_WEB_FEATURES_RESOURCES_UI", { default: false });
}
