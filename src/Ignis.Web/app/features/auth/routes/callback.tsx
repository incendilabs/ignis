/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { CookieTooLargeError, SESSION_EVENT } from "@eventuras/fides-auth";
import {
  buildSessionFromTokens,
  exchangeAuthorizationCode,
  validateReturnUrl,
} from "@eventuras/fides-auth/oauth";
import { persistSession } from "@eventuras/fides-auth/server";
import { redirect } from "react-router";

import { env } from "#app/env.server";
import { Logger } from "#app/logger";

import type { Route } from "./+types/callback";
import { appUrl, isEnabled, oauth } from "../config.server";
import {
  oauthStateCookie,
  oauthVerifierCookie,
  readCookieString,
  returnToCookie,
} from "../cookies.server";
import { requestedPage } from "../login-redirect";
import { LEGACY_SESSION_COOKIE, sessionCookieStore } from "../session-cookies.server";

const logger = Logger.create({ namespace: "auth:callback" });

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const url = new URL(request.url);

  // OAuth error response from the IdP (e.g. user cancelled) — drop state and return home.
  const oauthError = url.searchParams.get("error");
  if (oauthError !== null) {
    const description = url.searchParams.get("error_description");
    logger.warn({ context: { oauthError, description } }, "OAuth callback received error response");
    const headers = new Headers();
    headers.append("Set-Cookie", await oauthStateCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await returnToCookie.serialize("", { maxAge: 0 }));
    return redirect("/", { headers });
  }

  const cookieHeader = request.headers.get("Cookie");
  const returnToRaw = await readCookieString(returnToCookie, cookieHeader);
  const returnTo = validateReturnUrl(returnToRaw, appUrl());
  const state = await readCookieString(oauthStateCookie, cookieHeader);
  const verifier = await readCookieString(oauthVerifierCookie, cookieHeader);
  if (state === null || verifier === null) {
    logger.warn("OAuth callback: missing state or verifier cookie");
    const headers = new Headers();
    headers.append("Set-Cookie", await oauthStateCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await returnToCookie.serialize("", { maxAge: 0 }));
    return redirect("/", { headers });
  }

  try {
    const tokens = await exchangeAuthorizationCode(oauth(), url, verifier, state);
    const session = buildSessionFromTokens(tokens);

    // Throws CookieTooLargeError rather than letting the browser drop the cookie and loop.
    const cookies = sessionCookieStore(request);
    await persistSession(cookies, session, env("IGNIS_WEB_SESSION_SECRET"), {
      event: SESSION_EVENT.CREATED,
    });
    await cookies.delete(LEGACY_SESSION_COOKIE);

    const headers = cookies.headers;
    headers.append("Set-Cookie", await oauthStateCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await returnToCookie.serialize("", { maxAge: 0 }));

    return redirect(requestedPage(returnTo), { headers });
  } catch (error) {
    if (error instanceof CookieTooLargeError) {
      logger.error({ error, cookieName: error.cookieName, size: error.size }, "Session cookie too large");
    } else {
      logger.error({ error }, "Failed to exchange authorization code");
    }
    const headers = new Headers();
    headers.append("Set-Cookie", await oauthStateCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await returnToCookie.serialize("", { maxAge: 0 }));
    return redirect("/", { headers });
  }
}
