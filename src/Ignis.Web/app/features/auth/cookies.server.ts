/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { createCookie, type Cookie } from "react-router";

import { appUrl } from "./config.server";

// Browsers drop Secure cookies on plain http, so follow the app URL, not NODE_ENV.
export const secure = appUrl().startsWith("https:");

export const oauthStateCookie = createCookie("oauth_state", {
  httpOnly: true,
  sameSite: "lax",
  path: "/auth",
  maxAge: 600,
  secure,
});

export const oauthVerifierCookie = createCookie("oauth_code_verifier", {
  httpOnly: true,
  sameSite: "lax",
  path: "/auth",
  maxAge: 600,
  secure,
});

/** Where to send the user after the OAuth flow completes; set by /auth/login. */
export const returnToCookie = createCookie("oauth_return_to", {
  httpOnly: true,
  sameSite: "lax",
  path: "/auth",
  maxAge: 600,
  secure,
});

export async function readCookieString(
  cookie: Cookie,
  header: string | null,
): Promise<string | null> {
  const value: unknown = await cookie.parse(header);
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}
