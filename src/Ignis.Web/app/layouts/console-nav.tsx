/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { NavTree, type NavTreeGroup, type NavTreeItem } from "@eventuras/ratio-ui/core/NavTree";
import { Text } from "@eventuras/ratio-ui/core/Text";
import {
  Database,
  FolderOpen,
  LayoutGrid,
  ScrollText,
  Upload,
} from "@eventuras/ratio-ui/icons";
import { SearchField } from "@eventuras/ratio-ui/forms/SearchField";
import { type CSSProperties, type ReactNode, useState } from "react";
import { Link, useLocation } from "react-router";

import { m } from "#app/i18n/paraglide/messages";
import { fhirResourcePath } from "#app/lib/fhir/http";
import { locales } from "#app/i18n/paraglide/runtime";

const ICON_SIZE = 18;

const PINNED_NAV_TYPES = ["Patient", "Practitioner", "Observation", "Questionnaire"];

export interface ConsoleNavFeatures {
  resources: boolean;
  admin: boolean;
  operations: boolean;
}

/**
 * Adapts NavTree's href contract to react-router's Link. Spread the rest:
 * NavTree passes style (depth indent), aria-current and rail semantics.
 */
function NavLink({
  href,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  "aria-current"?: "page";
  "aria-label"?: string;
  title?: string;
}) {
  return <Link to={href} {...rest} />;
}

/** Strips the optional locale prefix so nav hrefs match the current path. */
function stripLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/** The filterable per-type rows of the Resources branch: filter field, matches, empty state. */
function resourceTypeItems(
  allTypes: string[],
  visibleTypes: string[],
  filter: { value: string; onChange: (value: string) => void; },
): NavTreeItem[] {
  if (allTypes.length === 0) return [];

  // Types come from the CapabilityStatement; validate before building paths,
  // dropping anything odd — the same stance as ResourceLink.
  const rows: NavTreeItem[] = visibleTypes.flatMap((type) => {
    const path = fhirResourcePath(type);
    if (path === null) return [];
    return [{ title: type, href: `/resources/${path}` }];
  });

  return [
    {
      id: "resource-type-filter",
      content: (
        <SearchField
          size="sm"
          value={filter.value}
          onChange={filter.onChange}
          placeholder={m.nav_filter_types()}
          aria-label={m.nav_filter_types()}
        />
      ),
    },
    ...rows,
    ...(rows.length === 0 && filter.value.trim() !== ""
      ? [
          {
            id: "resource-type-no-match",
            content: (
              <Text size="sm" variant="subtle">
                {m.nav_filter_no_match()}
              </Text>
            ),
          },
        ]
      : []),
  ];
}

/** The console sidebar's navigation tree: workspace and administration groups. */
export function ConsoleNav({
  features,
  resourceTypes,
  iconOnly,
}: {
  features: ConsoleNavFeatures;
  resourceTypes: string[];
  iconOnly: boolean;
}) {
  const { pathname } = useLocation();

  const [typeFilter, setTypeFilter] = useState("");
  const filterQuery = typeFilter.trim().toLowerCase();
  // Without a filter, only the pinned selection shows; searching spans every
  // declared type. Later, users get to choose their own pinned set.
  const visibleTypes =
    filterQuery === ""
      ? PINNED_NAV_TYPES.filter((type) => resourceTypes.includes(type))
      : resourceTypes.filter((type) => type.toLowerCase().includes(filterQuery));

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
                defaultOpen: true,
                children: [
                  { title: m.nav_all_resources(), href: "/resources" },
                  ...resourceTypeItems(resourceTypes, visibleTypes, {
                    value: typeFilter,
                    onChange: setTypeFilter,
                  }),
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
    <NavTree
      groups={groups}
      currentPath={stripLocale(pathname)}
      iconOnly={iconOnly}
      LinkComponent={NavLink}
      aria-label={m.nav_console()}
    />
  );
}
