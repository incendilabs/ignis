/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { ActionButton } from "@eventuras/ratio-ui/core/ActionButton";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { ChevronsLeft, ChevronsRight } from "@eventuras/ratio-ui/icons";
import { Box } from "@eventuras/ratio-ui/layout/Box";
import { Sidebar } from "@eventuras/ratio-ui/layout/Sidebar";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router";

import { Navbar } from "#app/components/ui/navbar";
import * as adminConfig from "#app/features/admin/config.server";
import { getSessionFromRequest } from "#app/features/auth/session.server";
import * as operationsConfig from "#app/features/operations/config.server";
import * as resourcesConfig from "#app/features/resources-ui/config.server";
import { fetchResourceTypes } from "#app/features/resources-ui/fhir-client.server";
import { m } from "#app/i18n/paraglide/messages";
import { useRootData } from "#app/lib/use-root-data";

import type { Route } from "./+types/console";
import { ConsoleNav } from "./console-nav";

export async function loader({ request }: Route.LoaderArgs) {
  const features = {
    resources: resourcesConfig.isEnabled(),
    admin: adminConfig.isEnabled(),
    operations: operationsConfig.isEnabled(),
  };

  // The nav's type list is best-effort: without a session (or with an
  // unreachable FHIR server) it stays empty — child loaders own the redirects.
  // Types only — per-type counts would fan out on every console page load.
  let resourceTypes: string[] = [];
  if (features.resources) {
    const session = await getSessionFromRequest(request);
    if (session !== null) {
      resourceTypes =
        (await fetchResourceTypes(request, session.tokens?.accessToken)) ?? [];
    }
  }

  return { features, resourceTypes };
}

const SIDEBAR_COLLAPSED_KEY = "ignis-sidebar-collapsed";

/** Console chrome for every page except the front page: left sidebar navigation. */
export default function ConsoleLayout({ loaderData }: Route.ComponentProps) {
  const root = useRootData();

  // SSR renders expanded; the saved preference is applied after hydration.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
  }, []);
  const toggleSidebar = () => {
    setCollapsed((prev) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!prev));
      return !prev;
    });
  };

  return (
    <Stack direction="horizontal" align="start">
      <Sidebar aria-label={m.nav_console()} collapsed={collapsed}>
        <Sidebar.Header>
          <Stack
            direction={collapsed ? "vertical" : "horizontal"}
            gap="sm"
            align="center"
            justify="between"
          >
            <Link to="/">
              <Stack direction="horizontal" gap="sm" align="center">
                <img src="/images/ignis-logo.png" alt={m.app_name()} width={32} height={32} />
                {!collapsed && (
                  <Text as="span" size="xl" weight="bold">
                    {m.app_name()}
                  </Text>
                )}
              </Stack>
            </Link>
            <ActionButton
              ariaLabel={collapsed ? m.nav_sidebar_expand() : m.nav_sidebar_collapse()}
              aria-pressed={collapsed}
              onClick={toggleSidebar}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            </ActionButton>
          </Stack>
        </Sidebar.Header>
        <Sidebar.Body>
          <ConsoleNav
            features={loaderData.features}
            resourceTypes={loaderData.resourceTypes}
            iconOnly={collapsed}
          />
        </Sidebar.Body>
      </Sidebar>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Navbar features={root.features} user={root.auth.user} showBrand={false} />
        <Outlet />
      </Box>
    </Stack>
  );
}
