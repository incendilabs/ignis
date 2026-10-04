/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { redirect } from "react-router";

/** Login URL that brings the user back to `returnTo` after the OAuth flow. */
export function loginUrl(returnTo: string): string {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function requestedPage(url: URL): string {
  // Normalize the pathname to remove any `.data` suffix and handle special cases.
  const pathname = url.pathname === "/_root.data" ? "/" : url.pathname.replace(/\.data$/, "");
  const query = new URLSearchParams(url.search);
  query.delete("_routes");
  const search = query.toString();
  return search === "" ? pathname : `${pathname}?${search}`;
}

/** Redirects to login, remembering the requested page for after the OAuth flow. */
export function redirectToLogin(request: Request): Response {
  return redirect(loginUrl(requestedPage(new URL(request.url))));
}
