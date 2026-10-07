/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { tryReadSession } from "@eventuras/fides-auth/server";
import type { Session } from "@eventuras/fides-auth/types";

import { env } from "#app/env.server";

import { redirectToLogin } from "./login-redirect";
import { sessionCookieStore } from "./session-cookies.server";
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
  const { session } = await tryReadSession(sessionCookieStore(request), env("IGNIS_WEB_SESSION_SECRET"));
  if (session === null) return { status: SessionStatus.Anonymous, session: null };

  const accessTokenExpiresIn = secondsUntilAccessTokenExpires(session);
  const expired = accessTokenExpiresIn !== undefined && accessTokenExpiresIn <= 0;
  return {
    status: expired ? SessionStatus.Expired : SessionStatus.Valid,
    session,
    accessTokenExpiresIn,
  };
}

// accessTokenExpiresAt first: OpenIddict access tokens are JWE, so their `exp` can't be read here.
function secondsUntilAccessTokenExpires(session: Session): number | undefined {
  const expiresAt = session.tokens?.accessTokenExpiresAt;
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : NaN;
  if (Number.isFinite(expiresAtMs)) return Math.floor((expiresAtMs - Date.now()) / 1000);

  const payload = session.tokens?.accessToken?.split(".")[1];
  if (payload === undefined) return undefined;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp?: unknown };
    return typeof exp === "number" ? Math.floor(exp - Date.now() / 1000) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the session only while its access token is still valid, or null
 * otherwise (expired, missing, or tampered).
 */
export async function getSessionFromRequest(request: Request): Promise<Session | null> {
  const state = await getSessionStateFromRequest(request);
  return state.status === SessionStatus.Valid ? state.session : null;
}

/**
 * The session, for loaders that require a signed-in user — or a thrown
 * redirect to login that returns to the requested URL after the OAuth flow.
 */
export async function requireSession(request: Request): Promise<Session> {
  const session = await getSessionFromRequest(request);
  if (session === null) throw redirectToLogin(request);
  return session;
}
