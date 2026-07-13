/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { useRouteLoaderData } from "react-router";

import type { loader as rootLoader } from "#app/root";

/** The root loader's data (features + auth), for layouts that render app chrome. */
export function useRootData() {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  if (data === undefined) {
    throw new Error("useRootData must be used under the root route");
  }
  return data;
}
