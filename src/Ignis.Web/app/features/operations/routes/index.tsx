/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Unauthorized } from "@eventuras/ratio-ui/blocks/Unauthorized";
import { Console } from "@eventuras/ratio-ui/console";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { getSessionFromRequest } from "#app/features/auth/session.server";
import { scopes } from "#app/features/admin/scopes";
import { m } from "#app/i18n/paraglide/messages";

import type { Route } from "./+types/index";
import { isEnabled } from "../config.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await getSessionFromRequest(request);
  if (session === null) return redirect("/auth/login");
  const grantedScopes = session.scopes ?? [];
  return { isAuthorized: grantedScopes.includes(scopes.operationsRead) };
}

// Dummy stream — replaced with real SSE-backed events in a follow-up PR.
const dummyEvents = [
  {
    id: 1,
    hhmmss: "12:00:00",
    ms: "123",
    level: "info" as const,
    source: "Import",
    message: "Found 21 entries in archive.",
  },
  {
    id: 2,
    hhmmss: "12:00:00",
    ms: "456",
    level: "debug" as const,
    source: "Import",
    message: "Processed account-example.json",
  },
  {
    id: 3,
    hhmmss: "12:00:00",
    ms: "789",
    level: "success" as const,
    source: "Spark",
    message: "Imported Patient/example",
  },
  {
    id: 4,
    hhmmss: "12:00:01",
    ms: "123",
    level: "warning" as const,
    source: "Import",
    message: "Skipping oversize entry: huge-bundle.json",
  },
  {
    id: 5,
    hhmmss: "12:00:01",
    ms: "456",
    level: "error" as const,
    source: "Import",
    message: "Failed to ingest entry: codesystem-snomedct.json",
  },
  {
    id: 6,
    hhmmss: "12:00:02",
    ms: "789",
    level: "success" as const,
    source: "Import",
    message: "Enumerated 21 entries. Imported 18, skipped 2, failed 1.",
  },
];

export default function OperationsIndex({ loaderData }: Route.ComponentProps) {
  if (!loaderData.isAuthorized) {
    return <Unauthorized />;
  }

  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Heading as="h1">{m.operations_title()}</Heading>
          <Text>{m.operations_subtitle()}</Text>
        </Stack>

        <Console theme="dark" aria-label={m.operations_console_title()}>
          <Console.TitleBar>
            <Console.Title>{m.operations_console_title()}</Console.Title>
            <Console.Counter>
              <b>{dummyEvents.length}</b> events
            </Console.Counter>
          </Console.TitleBar>
          <Console.Body>
            {dummyEvents.map((ev) => (
              <Console.Entry
                key={ev.id}
                timestamp={<Console.Time hhmmss={ev.hhmmss} ms={ev.ms} />}
                level={ev.level}
                source={ev.source}
                message={ev.message}
              />
            ))}
          </Console.Body>
        </Console>

        <Text>{m.operations_console_status_dummy()}</Text>
      </Stack>
    </Container>
  );
}
