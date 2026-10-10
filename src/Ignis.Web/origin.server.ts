/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { RequestHandler } from "express";

/**
 * The app serves one public origin: scheme, host and optional port. A trailing slash
 * is dropped; anything more is rejected so a typo shows at startup, not at login.
 */
export function parseAppUrl(value: string | undefined): URL {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") {
    throw new Error(
      "IGNIS_WEB_APP_URL is required: the public URL of the web app, e.g. https://ignis.example.com",
    );
  }
  const url = new URL(trimmed);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`IGNIS_WEB_APP_URL must be http or https, got "${trimmed}"`);
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error(
      `IGNIS_WEB_APP_URL must be scheme and host only, like "${url.origin}", got "${trimmed}"`,
    );
  }
  // @react-router/express splits Host on ":" to find the port, which loses it for IPv6.
  if (url.hostname.startsWith("[")) {
    throw new Error(`IGNIS_WEB_APP_URL can't be an IPv6 address, got "${trimmed}"`);
  }
  return new URL(url.origin);
}

/**
 * Makes the React Router adapter build request.url on the app origin, whatever Host
 * and X-Forwarded-* say. Rejects absolute-form request targets, which would escape it.
 */
export function pinOrigin(appUrl: URL): RequestHandler {
  return (req, res, next) => {
    if (!req.originalUrl.startsWith("/")) {
      res.status(400).end();
      return;
    }
    // Unused once pinned; dropped so they can't be read if trust proxy is ever enabled.
    delete req.headers["x-forwarded-host"];
    delete req.headers["x-forwarded-proto"];
    delete req.headers.forwarded;
    Object.defineProperty(req, "protocol", { value: appUrl.protocol.slice(0, -1) });
    Object.defineProperty(req, "hostname", { value: appUrl.hostname });
    req.headers.host = appUrl.host;
    next();
  };
}
