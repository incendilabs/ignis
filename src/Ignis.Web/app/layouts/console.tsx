/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { ActionButton } from "@eventuras/ratio-ui/core/ActionButton";
import { NavTree, type NavTreeGroup } from "@eventuras/ratio-ui/core/NavTree";
import { Text } from "@eventuras/ratio-ui/core/Text";
import {
  ChevronsLeft,
  ChevronsRight,
  Database,
  FolderOpen,
  LayoutGrid,
  ScrollText,
  Upload,
} from "@eventuras/ratio-ui/icons";
import { Box } from "@eventuras/ratio-ui/layout/Box";
import { Sidebar } from "@eventuras/ratio-ui/layout/Sidebar";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { type ReactNode, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";

import { Navbar } from "#app/components/ui/navbar";
import * as adminConfig from "#app/features/admin/config.server";
import * as operationsConfig from "#app/features/operations/config.server";
import * as resourcesConfig from "#app/features/resources-ui/config.server";
import { m } from "#app/i18n/paraglide/messages";
import { locales } from "#app/i18n/paraglide/runtime";
import { useRootData } from "#app/lib/use-root-data";

import type { Route } from "./+types/console";

export function loader() {
  return {
    features: {
      resources: resourcesConfig.isEnabled(),
      admin: adminConfig.isEnabled(),
      operations: operationsConfig.isEnabled(),
    },
  };
}

const ICON_SIZE = 18;

/** Adapts NavTree's href contract to react-router's Link. */
function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

/** Strips the optional locale prefix so nav hrefs match the current path. */
function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

const SIDEBAR_COLLAPSED_KEY = "ignis-sidebar-collapsed";

/** Console chrome for every page except the front page: left sidebar navigation. */
export default function ConsoleLayout({ loaderData }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const { features } = loaderData;
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

  const groups: NavTreeGroup[] = [
    {
      label: m.nav_workspace(),
      items: [
        // The dashboard reads the FHIR capability statement, so it follows the resources feature.
        ...(features.resources
          ? [
              {
                title: m.nav_dashboard(),
                href: "/user",
                icon: <LayoutGrid size={ICON_SIZE} />,
              },
              {
                title: m.resources_title(),
                icon: <FolderOpen size={ICON_SIZE} />,
                children: [
                  { title: m.nav_all_resources(), href: "/resources" },
                  { title: "Patient", href: "/resources/Patient" },
                  { title: "Practitioner", href: "/resources/Practitioner" },
                  { title: "Observation", href: "/resources/Observation" },
                  { title: "Questionnaire", href: "/resources/Questionnaire" },
                ],
              },
            ]
          : []),
      ],
    },
    ...(features.admin
      ? [
          {
            label: m.nav_administration(),
            items: [
              {
                title: m.admin_database_title(),
                href: "/admin/database",
                icon: <Database size={ICON_SIZE} />,
              },
              {
                title: m.import_title(),
                href: "/admin/import",
                icon: <Upload size={ICON_SIZE} />,
              },
              ...(features.operations
                ? [
                    {
                      title: m.operations_title(),
                      href: "/admin/operations",
                      icon: <ScrollText size={ICON_SIZE} />,
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

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
          <NavTree
            groups={groups}
            currentPath={stripLocale(pathname)}
            iconOnly={collapsed}
            LinkComponent={NavLink}
            aria-label={m.nav_console()}
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
