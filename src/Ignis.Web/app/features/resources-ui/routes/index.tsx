/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Lead } from "@eventuras/ratio-ui/core/Lead";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Table } from "@eventuras/ratio-ui/core/Table";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { SearchField } from "@eventuras/ratio-ui/forms/SearchField";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { useState } from "react";
import { redirect } from "react-router";

import { requireSession } from "#app/features/auth/session.server";
import { m } from "#app/i18n/paraglide/messages";
import { resourceCategory } from "#app/lib/fhir/categories";

import type { Route } from "./+types/index";
import { isEnabled } from "../config.server";
import { fetchResourceTypesWithCounts } from "../fhir-client.server";
import { ResourceLink } from "../ResourceLink";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await requireSession(request);

  const rows = await fetchResourceTypesWithCounts(request, session.tokens?.accessToken);
  if (rows === null) {
    return { ok: false as const, rows: [] };
  }
  return { ok: true as const, rows };
}

const CATEGORY_LABELS = {
  clinical: m.resources_category_clinical,
  care: m.resources_category_care,
  medications: m.resources_category_medications,
  diagnostics: m.resources_category_diagnostics,
  administrative: m.resources_category_administrative,
  foundation: m.resources_category_foundation,
  financial: m.resources_category_financial,
} as const;

function categoryLabel(type: string): string | null {
  const category = resourceCategory(type);
  return category === null ? null : CATEGORY_LABELS[category]();
}

export default function ResourcesIndex({ loaderData }: Route.ComponentProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = loaderData.ok
    ? loaderData.rows.filter(
        (row) =>
          q === "" ||
          row.type.toLowerCase().includes(q) ||
          (categoryLabel(row.type)?.toLowerCase().includes(q) ?? false),
      )
    : [];

  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Heading as="h1">{m.resources_title()}</Heading>
          <Lead>{m.resources_subtitle()}</Lead>
        </Stack>

        {loaderData.ok ? (
          <>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={m.resources_filter_placeholder()}
              aria-label={m.resources_filter_placeholder()}
            />
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeadCell>{m.resources_table_type()}</Table.HeadCell>
                  <Table.HeadCell>{m.resources_table_category()}</Table.HeadCell>
                  <Table.HeadCell>{m.resources_table_count()}</Table.HeadCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((row) => (
                  <Table.Row key={row.type}>
                    <Table.Cell>
                      <ResourceLink type={row.type}>{row.type}</ResourceLink>
                    </Table.Cell>
                    <Table.Cell>{categoryLabel(row.type) ?? "—"}</Table.Cell>
                    <Table.Cell>{row.count ?? "—"}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </>
        ) : (
          <Panel variant="alert" status="error">
            <Text>{m.resources_capability_error()}</Text>
          </Panel>
        )}
      </Stack>
    </Container>
  );
}
