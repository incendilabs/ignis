/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { redirect } from "react-router";

import { getSessionFromRequest } from "#app/features/auth/session.server";
import { isValidFhirId, isValidFhirResourceTypeName } from "#app/lib/fhir/validation";

import type { Route } from "./+types/$resourceType.$id.xml";
import { isEnabled } from "../config.server";
import { fetchResourceXml } from "../fhir-client.server";

/**
 * Data-only route that serves a resource's FHIR XML serialization, fetched on
 * demand when the XML tab on the instance page is opened.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await getSessionFromRequest(request);
  if (session === null) return redirect("/auth/login");

  const { resourceType, id } = params;
  if (!isValidFhirResourceTypeName(resourceType) || !isValidFhirId(id)) {
    return { ok: false as const };
  }

  const xml = await fetchResourceXml(
    request,
    session.tokens?.accessToken,
    resourceType,
    id,
  );
  if (xml === null) return { ok: false as const };

  return { ok: true as const, xml };
}
