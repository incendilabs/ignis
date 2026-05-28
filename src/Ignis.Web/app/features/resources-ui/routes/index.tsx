/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Table } from "@eventuras/ratio-ui/core/Table";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { getSessionFromRequest } from "#app/features/auth/session.server";
import { m } from "#app/i18n/paraglide/messages";

import type { Route } from "./+types/index";
import { isEnabled } from "../config.server";
import { fetchResourceCount, fetchResourceTypes } from "../fhir-client.server";

interface ResourceRow {
  type: string;
  count: number | null;
}

// Cap parallel count requests so a 140-type CapabilityStatement doesn't
// fire 140 concurrent calls at the FHIR backend on every page load.
const COUNT_FETCH_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  }
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await getSessionFromRequest(request);
  if (session === null) return redirect("/auth/login");

  const accessToken = session.tokens?.accessToken;
  const types = await fetchResourceTypes(request, accessToken);
  if (types === null) {
    return { ok: false as const, rows: [] };
  }

  const rows: ResourceRow[] = await mapWithConcurrency(
    types,
    COUNT_FETCH_CONCURRENCY,
    async (type) => ({
      type,
      count: await fetchResourceCount(request, accessToken, type),
    }),
  );
  rows.sort((a, b) => a.type.localeCompare(b.type));
  return { ok: true as const, rows };
}

export default function ResourcesIndex({ loaderData }: Route.ComponentProps) {
  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Heading as="h1">{m.resources_title()}</Heading>
          <Text>{m.resources_subtitle()}</Text>
        </Stack>

        {loaderData.ok ? (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeadCell>{m.resources_table_type()}</Table.HeadCell>
                <Table.HeadCell>{m.resources_table_count()}</Table.HeadCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {loaderData.rows.map((row) => (
                <Table.Row key={row.type}>
                  <Table.Cell>{row.type}</Table.Cell>
                  <Table.Cell>{row.count ?? "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        ) : (
          <Panel variant="alert" status="error">
            <Text>{m.resources_capability_error()}</Text>
          </Panel>
        )}
      </Stack>
    </Container>
  );
}
