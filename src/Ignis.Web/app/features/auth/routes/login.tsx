/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { buildPKCEOptions, discoverAndBuildAuthorizationUrl } from "@eventuras/fides-auth/oauth";
import { redirect } from "react-router";

import { isEnabled, oauth } from "../config.server";
import { oauthStateCookie, oauthVerifierCookie } from "../cookies.server";

export async function loader() {
  if (!isEnabled()) return redirect("/");
  try {
    const oauthConfig = oauth();
    const pkce = await buildPKCEOptions(oauthConfig);
    const authorizeUrl = await discoverAndBuildAuthorizationUrl(oauthConfig, pkce);

    const headers = new Headers();
    headers.append("Set-Cookie", await oauthStateCookie.serialize(pkce.state));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize(pkce.code_verifier));

    return redirect(authorizeUrl.toString(), { headers });
  } catch (error) {
    console.error("Failed to start OAuth flow:", error);
    throw new Error("Authorization server unavailable");
  }
}
