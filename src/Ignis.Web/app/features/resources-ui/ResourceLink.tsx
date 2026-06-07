/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Link } from "@eventuras/ratio-ui/core/Link";
import type { ReactNode } from "react";

import { fhirResourcePath } from "#app/lib/fhir/http";

/**
 * Links to a resource type listing or a single instance, falling back to plain
 * text when the type/id isn't a valid FHIR name/id.
 */
export function ResourceLink({
  type,
  id,
  children,
}: {
  type: string;
  id?: string;
  children: ReactNode;
}) {
  const path = fhirResourcePath(type, id);
  if (path === null) return <>{children}</>;
  return <Link href={`/resources/${path}`}>{children}</Link>;
}
