/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { redirect } from "react-router";

import { requireSession } from "#app/features/auth/session.server";

import type { Route } from "./+types/expansions";
import { isEnabled } from "../config.server";
import { expandValueSets } from "../expand.server";

/** Upper bound on `url` parameters per call; a Questionnaire rarely binds more. */
const MAX_CANONICALS = 50;

/**
 * Data-only route that expands the ValueSets named by repeated `url` query parameters
 * (`url` or `url|version`), fetched on demand when a Questionnaire's Form tab opens.
 */
export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await requireSession(request);

  const canonicals = [...new Set(new URL(request.url).searchParams.getAll("url"))]
    .filter((canonical) => canonical !== "")
    .slice(0, MAX_CANONICALS);

  const expansions = await expandValueSets(request, session.tokens?.accessToken, canonicals);
  return { expansions };
}
