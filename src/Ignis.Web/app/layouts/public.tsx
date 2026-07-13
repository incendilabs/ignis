/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Outlet } from "react-router";

import { Navbar } from "#app/components/ui/navbar";
import { useRootData } from "#app/lib/use-root-data";

/** For pages without the console sidebar: just the top navbar. */
export default function PublicLayout() {
  const { features, auth } = useRootData();
  return (
    <>
      <Navbar features={features} user={auth.user} />
      <Outlet />
    </>
  );
}
