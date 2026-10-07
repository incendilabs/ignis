/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { clearSession } from "@eventuras/fides-auth/server";
import { redirect } from "react-router";

import type { Route } from "./+types/logout";
import { LEGACY_SESSION_COOKIE, sessionCookieStore } from "../session-cookies.server";

// POST-only so a prefetch or stray GET can't silently log the user out.
export async function action({ request }: Route.ActionArgs) {
  const cookies = sessionCookieStore(request);
  await clearSession(cookies, { trigger: "logout" });
  await cookies.delete(LEGACY_SESSION_COOKIE);
  return redirect("/", { headers: cookies.headers });
}

// A direct GET (e.g. a stale link) just bounces home without clearing anything.
export function loader() {
  return redirect("/");
}
