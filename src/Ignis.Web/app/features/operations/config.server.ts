/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { envBool } from "#app/env.server";
import * as adminConfig from "#app/features/admin/config.server";

export function isEnabled(): boolean {
  // Operations lives under the admin surface — requires admin (which in turn
  // requires auth) plus its own IGNIS_WEB_FEATURES_OPERATIONS flag.
  return adminConfig.isEnabled() && envBool("IGNIS_WEB_FEATURES_OPERATIONS", { default: false });
}
