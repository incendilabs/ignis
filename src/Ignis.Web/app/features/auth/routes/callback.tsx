/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { createEncryptedJWT } from "@eventuras/fides-auth";
import { buildSessionFromTokens, exchangeAuthorizationCode } from "@eventuras/fides-auth/oauth";
import { redirect } from "react-router";

import { env } from "@/env.server";

import type { Route } from "./+types/callback";
import { isEnabled, oauth } from "../config.server";
import {
  oauthStateCookie,
  oauthVerifierCookie,
  readCookieString,
  sessionCookie,
} from "../cookies.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const url = new URL(request.url);

  // OAuth error response from the IdP (e.g. user cancelled) — drop state and return home.
  const oauthError = url.searchParams.get("error");
  if (oauthError !== null) {
    const description = url.searchParams.get("error_description");
    console.warn("OAuth callback received error response:", oauthError, description ?? "");
    const headers = new Headers();
    headers.append("Set-Cookie", await oauthStateCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize("", { maxAge: 0 }));
    return redirect("/", { headers });
  }

  const cookieHeader = request.headers.get("Cookie");
  const state = await readCookieString(oauthStateCookie, cookieHeader);
  const verifier = await readCookieString(oauthVerifierCookie, cookieHeader);
  if (state === null || verifier === null) {
    console.warn("OAuth callback: missing state or verifier cookie");
    const headers = new Headers();
    headers.append("Set-Cookie", await oauthStateCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize("", { maxAge: 0 }));
    return redirect("/", { headers });
  }

  try {
    const tokens = await exchangeAuthorizationCode(oauth(), url, verifier, state);
    const session = buildSessionFromTokens(tokens);
    const jwt = await createEncryptedJWT(session, env("IGNIS_WEB_SESSION_SECRET"));

    const headers = new Headers();
    headers.append("Set-Cookie", await sessionCookie.serialize(jwt));
    headers.append("Set-Cookie", await oauthStateCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize("", { maxAge: 0 }));

    return redirect("/", { headers });
  } catch (error) {
    console.error("Failed to exchange authorization code:", error);
    const headers = new Headers();
    headers.append("Set-Cookie", await oauthStateCookie.serialize("", { maxAge: 0 }));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize("", { maxAge: 0 }));
    return redirect("/", { headers });
  }
}
