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

/** Redirects to login, remembering the requested URL for after the OAuth flow. */
export function redirectToLogin(request: Request): Response {
  const url = new URL(request.url);
  return redirect(loginUrl(url.pathname + url.search));
}
