/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  buildPKCEOptions,
  discoverAndBuildAuthorizationUrl,
  validateReturnUrl,
} from "@eventuras/fides-auth/oauth";
import { redirect } from "react-router";

import { Logger } from "#app/logger";

import type { Route } from "./+types/login";
import { appUrl, isEnabled, oauth } from "../config.server";
import { oauthStateCookie, oauthVerifierCookie, returnToCookie } from "../cookies.server";

const logger = Logger.create({ namespace: "auth:login" });

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  try {
    const oauthConfig = oauth();
    const pkce = await buildPKCEOptions(oauthConfig);
    const authorizeUrl = await discoverAndBuildAuthorizationUrl(oauthConfig, pkce);

    const headers = new Headers();
    headers.append("Set-Cookie", await oauthStateCookie.serialize(pkce.state));
    headers.append("Set-Cookie", await oauthVerifierCookie.serialize(pkce.code_verifier));

    const requested = new URL(request.url).searchParams.get("returnTo");
    if (requested !== null) {
      const returnTo = validateReturnUrl(requested, appUrl());
      headers.append(
        "Set-Cookie",
        await returnToCookie.serialize(returnTo.pathname + returnTo.search),
      );
    }

    return redirect(authorizeUrl.toString(), { headers });
  } catch (error) {
    logger.error({ error }, "Failed to start OAuth flow");
    throw new Error("Authorization server unavailable", { cause: error });
  }
}
