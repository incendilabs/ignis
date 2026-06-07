/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Table } from "@eventuras/ratio-ui/core/Table";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { getSessionFromRequest } from "#app/features/auth/session.server";
import { m } from "#app/i18n/paraglide/messages";
import { isValidFhirResourceTypeName } from "#app/lib/fhir/validation";

import type { Route } from "./+types/$resourceType";
import { isEnabled } from "../config.server";
import {
  fetchResourceCount,
  fetchResourceList,
} from "../fhir-client.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await getSessionFromRequest(request);
  if (session === null) return redirect("/auth/login");

  const resourceType = params.resourceType;
  if (!isValidFhirResourceTypeName(resourceType)) {
    return redirect("/resources");
  }

  const accessToken = session.tokens?.accessToken;
  const [count, resources] = await Promise.all([
    fetchResourceCount(request, accessToken, resourceType),
    fetchResourceList(request, accessToken, resourceType),
  ]);

  if (resources === null) {
    return {
      ok: false as const,
      resourceType,
    };
  }

  return {
    ok: true as const,
    count,
    resourceType,
    resources,
  };
}

export default function ResourceTypeDetails({ loaderData }: Route.ComponentProps) {
  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Text>
            <Link href="/resources">{m.resources_detail_back()}</Link>
          </Text>
          <Heading as="h1">{loaderData.resourceType}</Heading>
          {loaderData.ok ? (
            <Text>
              {m.resources_detail_summary({
                count: loaderData.count ?? m.resources_detail_count_unknown(),
                shown: loaderData.resources.length,
              })}
            </Text>
          ) : null}
        </Stack>

        {loaderData.ok ? (
          loaderData.resources.length > 0 ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeadCell>{m.resources_detail_id()}</Table.HeadCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loaderData.resources.map((resource) => (
                  <Table.Row key={resource.id}>
                    <Table.Cell>{resource.id}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <Panel variant="notice" status="info">
              <Text>{m.resources_detail_empty()}</Text>
            </Panel>
          )
        ) : (
          <Panel variant="alert" status="error">
            <Text>{m.resources_detail_error()}</Text>
          </Panel>
        )}
      </Stack>
    </Container>
  );
}
