/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { validateSessionJwt } from "@eventuras/fides-auth";
import type { Session } from "@eventuras/fides-auth/types";

import { env } from "@/env.server";

import { readCookieString, sessionCookie } from "./cookies.server";

export async function getSessionFromRequest(request: Request): Promise<Session | null> {
  const sessionJwt = await readCookieString(sessionCookie, request.headers.get("Cookie"));
  if (sessionJwt === null) return null;
  const result = await validateSessionJwt(sessionJwt, env("IGNIS_WEB_SESSION_SECRET"));
  return result.status === "VALID" && result.session ? result.session : null;
}
