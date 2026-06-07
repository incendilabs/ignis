/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { getSessionFromRequest } from "#app/features/auth/session.server";
import { m } from "#app/i18n/paraglide/messages";
import { isValidFhirId, isValidFhirResourceTypeName } from "#app/lib/fhir/validation";

import type { Route } from "./+types/$resourceType.$id";
import { ResourceDetail } from "../ResourceDetail";
import { isEnabled } from "../config.server";
import { fetchResource } from "../fhir-client.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await getSessionFromRequest(request);
  if (session === null) return redirect("/auth/login");

  const { resourceType, id } = params;
  if (!isValidFhirResourceTypeName(resourceType)) {
    return redirect("/resources");
  }
  if (!isValidFhirId(id)) {
    return redirect(`/resources/${resourceType}`);
  }

  const accessToken = session.tokens?.accessToken;
  const resource = await fetchResource(request, accessToken, resourceType, id);

  if (resource === null) {
    return { ok: false as const, resourceType, id };
  }

  return { ok: true as const, resourceType, id, resource };
}

export default function ResourceInstance({ loaderData }: Route.ComponentProps) {
  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Text>
            <Link href={`/resources/${loaderData.resourceType}`}>
              {m.resources_instance_back({ resourceType: loaderData.resourceType })}
            </Link>
          </Text>
          <Heading as="h1">
            {loaderData.resourceType}/{loaderData.id}
          </Heading>
        </Stack>

        {loaderData.ok ? (
          <ResourceDetail resource={loaderData.resource} />
        ) : (
          <Panel variant="alert" status="error">
            <Text>{m.resources_instance_error()}</Text>
          </Panel>
        )}
      </Stack>
    </Container>
  );
}
