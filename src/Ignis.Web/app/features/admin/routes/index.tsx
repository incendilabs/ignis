/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { redirect } from "react-router";

import { getSessionFromRequest } from "@/features/auth/session.server";

import type { Route } from "./+types/index";
import { isEnabled } from "../config.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await getSessionFromRequest(request);
  if (session === null) return redirect("/auth/login");
  // Don't return the session — it contains tokens and would be
  // serialized into loader data sent to the browser.
  return null;
}

export default function AdminIndex() {
  return (
    <main className="container mx-auto p-6">
      <h1 className="text-3xl">Admin</h1>
      <p className="mt-4">You are signed in.</p>
    </main>
  );
}
