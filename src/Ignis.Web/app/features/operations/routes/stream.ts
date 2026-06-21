/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { getSessionFromRequest } from "#app/features/auth/session.server";
import { scopes } from "#app/features/admin/scopes";

import type { Route } from "./+types/stream";
import { isEnabled } from "../config.server";
import { streamOperationEvents } from "../operations.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return new Response(null, { status: 404 });

  const session = await getSessionFromRequest(request);
  if (session === null) return new Response(null, { status: 401 });
  if (!(session.scopes ?? []).includes(scopes.operationsRead)) {
    return new Response(null, { status: 403 });
  }

  const accessToken = session.tokens?.accessToken;
  if (accessToken === undefined) return new Response(null, { status: 401 });

  return streamOperationEvents(request, accessToken);
}
