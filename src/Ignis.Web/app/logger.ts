/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Logger } from "@eventuras/logger";

Logger.configure({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

export { Logger };
