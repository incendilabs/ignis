/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { createCookie, type Cookie } from "react-router";

const isProd = process.env.NODE_ENV === "production";

export const sessionCookie = createCookie("ignis_session", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
  secure: isProd,
});

export const oauthStateCookie = createCookie("oauth_state", {
  httpOnly: true,
  sameSite: "lax",
  path: "/auth",
  maxAge: 600,
  secure: isProd,
});

export const oauthVerifierCookie = createCookie("oauth_code_verifier", {
  httpOnly: true,
  sameSite: "lax",
  path: "/auth",
  maxAge: 600,
  secure: isProd,
});

export async function readCookieString(
  cookie: Cookie,
  header: string | null,
): Promise<string | null> {
  const value: unknown = await cookie.parse(header);
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}
