/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { redirect } from "react-router";

import { sessionCookie } from "../cookies.server";

// POST-only so a prefetch or stray GET can't silently log the user out.
export async function action() {
  const headers = new Headers();
  headers.append("Set-Cookie", await sessionCookie.serialize("", { maxAge: 0 }));
  return redirect("/", { headers });
}

// A direct GET (e.g. a stale link) just bounces home without clearing anything.
export function loader() {
  return redirect("/");
}
