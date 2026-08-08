/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Box } from "@eventuras/ratio-ui/layout/Box";
import { Outlet } from "react-router";

import { SiteFooter } from "#app/components/ui/footer";
import { Navbar } from "#app/components/ui/navbar";
import { useRootData } from "#app/lib/use-root-data";

/** For pages without the console sidebar: top navbar and the site footer. */
export default function PublicLayout() {
  const { features, auth, footerLinks } = useRootData();
  return (
    // Column layout so a short page still puts the footer at the bottom.
    <Box style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar features={features} user={auth.user} />
      <Box style={{ flex: 1 }}>
        <Outlet />
      </Box>
      <SiteFooter links={footerLinks} />
    </Box>
  );
}
