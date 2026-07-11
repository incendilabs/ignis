/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { validateSessionJwt } from "@eventuras/fides-auth";
import type { Session } from "@eventuras/fides-auth/types";

import { env } from "#app/env.server";

import { readCookieString, sessionCookie } from "./cookies.server";
import { SessionStatus } from "./session-status";

export interface SessionState {
  status: SessionStatus;
  session: Session | null;
  accessTokenExpiresIn?: number;
}

/**
 * Resolves the session cookie into ANONYMOUS/VALID/EXPIRED, keeping "expired"
 * distinct from "never logged in" so the UI can prompt a re-login.
 */
export async function getSessionStateFromRequest(request: Request): Promise<SessionState> {
  const sessionJwt = await readCookieString(sessionCookie, request.headers.get("Cookie"));
  if (sessionJwt === null) return { status: SessionStatus.Anonymous, session: null };

  const result = await validateSessionJwt(sessionJwt, env("IGNIS_WEB_SESSION_SECRET"));
  if (result.session && (result.status === SessionStatus.Valid || result.status === SessionStatus.Expired)) {
    return {
      status: result.status,
      session: result.session,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
    };
  }
  return { status: SessionStatus.Anonymous, session: null };
}

/**
 * Returns the session only while its access token is still valid, or null
 * otherwise (expired, missing, or tampered).
 */
export async function getSessionFromRequest(request: Request): Promise<Session | null> {
  const state = await getSessionStateFromRequest(request);
  return state.status === SessionStatus.Valid ? state.session : null;
}
