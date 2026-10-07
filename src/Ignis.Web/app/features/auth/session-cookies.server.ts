/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { CookieOptions } from "@eventuras/fides-auth";
import type { CookieStore } from "@eventuras/fides-auth/server";

const isProd = process.env.NODE_ENV === "production";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Pre-split single-cookie session; cleared on login and logout so it stops riding along. */
export const LEGACY_SESSION_COOKIE = "ignis_session";

/** fides-auth's split session cookies, read from the request and written as Set-Cookie on `headers`. */
export interface RequestCookieStore extends CookieStore {
  headers: Headers;
}

export function sessionCookieStore(request: Request, headers = new Headers()): RequestCookieStore {
  const cookies = parseCookieHeader(request.headers.get("Cookie"));
  return {
    headers,
    get: (name) => cookies.get(name) ?? null,
    // Values are JWE compact strings (cookie-safe), so they're written raw, not re-encoded.
    set: (name, value, options) => {
      headers.append("Set-Cookie", serializeCookie(name, value, sessionOptions(options)));
    },
    delete: (name) => {
      headers.append("Set-Cookie", serializeCookie(name, "", { ...sessionOptions(), maxAge: 0 }));
    },
  };
}

// Keep the lifetime and dev-over-http behaviour of the other Ignis cookies.
function sessionOptions(options?: CookieOptions): CookieOptions {
  return { ...options, path: "/", maxAge: SESSION_MAX_AGE_SECONDS, secure: isProd };
}

function parseCookieHeader(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const pair of header?.split(";") ?? []) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    const name = pair.slice(0, separator).trim();
    if (!cookies.has(name)) cookies.set(name, pair.slice(separator + 1).trim());
  }
  return cookies;
}

// RFC 6265 token / cookie-octet subsets; anything else could split the Set-Cookie header.
const SAFE_NAME = /^[\w!#$%&'*+.^`|~-]+$/;
const SAFE_VALUE = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/;

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  if (!SAFE_NAME.test(name) || !SAFE_VALUE.test(value)) {
    throw new Error(`Refusing to write unsafe cookie "${name}"`);
  }
  const parts = [`${name}=${value}`, `Path=${options.path ?? "/"}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${String(options.maxAge)}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  const sameSite = options.sameSite ?? "lax";
  parts.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`);
  return parts.join("; ");
}
