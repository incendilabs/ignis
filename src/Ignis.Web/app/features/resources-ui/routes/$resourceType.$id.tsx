/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Badge } from "@eventuras/ratio-ui/core/Badge";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Link } from "@eventuras/ratio-ui/core/Link";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import type { ComponentProps } from "react";
import { redirect } from "react-router";

import { requireSession } from "#app/features/auth/session.server";
import { m } from "#app/i18n/paraglide/messages";
import { resourceStatus, resourceTitle } from "#app/lib/fhir/summary";
import { isValidFhirId, isValidFhirResourceTypeName } from "#app/lib/fhir/validation";

import type { Route } from "./+types/$resourceType.$id";
import { ResourceDetail } from "../ResourceDetail";
import { isEnabled } from "../config.server";
import { fetchResource } from "../fhir-client.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await requireSession(request);

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

/** Maps a FHIR status code onto a badge tone. */
function statusTone(status: string): ComponentProps<typeof Badge>["status"] {
  if (["active", "final", "completed"].includes(status)) return "success";
  if (["draft", "preliminary", "in-progress"].includes(status)) return "warning";
  if (["entered-in-error", "retired", "cancelled", "stopped"].includes(status)) return "error";
  return "neutral";
}

export default function ResourceInstance({ loaderData }: Route.ComponentProps) {
  const title = loaderData.ok ? resourceTitle(loaderData.resource) : null;
  const status = loaderData.ok ? resourceStatus(loaderData.resource) : null;
  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Text>
            <Link href={`/resources/${loaderData.resourceType}`}>
              {m.resources_instance_back({ resourceType: loaderData.resourceType })}
            </Link>
          </Text>
          <Stack direction="horizontal" align="center" gap="sm" wrap>
            <Heading as="h1">
              {title ?? `${loaderData.resourceType}/${loaderData.id}`}
            </Heading>
            {status !== null && <Badge status={statusTone(status)}>{status}</Badge>}
          </Stack>
        </Stack>

        {loaderData.ok ? (
          // Key by identity so navigating between instances on this same route
          // remounts and drops the previous resource's lazily-fetched XML.
          <ResourceDetail
            key={`${loaderData.resourceType}/${loaderData.id}`}
            resource={loaderData.resource}
            resourceType={loaderData.resourceType}
            id={loaderData.id}
          />
        ) : (
          <Panel variant="alert" status="error">
            <Text>{m.resources_instance_error()}</Text>
          </Panel>
        )}
      </Stack>
    </Container>
  );
}
