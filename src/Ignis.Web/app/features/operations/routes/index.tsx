/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Unauthorized } from "@eventuras/ratio-ui/blocks/Unauthorized";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { requireSession } from "#app/features/auth/session.server";
import { scopes } from "#app/features/admin/scopes";
import { m } from "#app/i18n/paraglide/messages";

import type { Route } from "./+types/index";
import { OperationsConsole } from "../components/OperationsConsole";
import { isEnabled } from "../config.server";
import { useOperationsStream } from "../use-operations-stream";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await requireSession(request);
  const grantedScopes = session.scopes ?? [];
  return { isAuthorized: grantedScopes.includes(scopes.operationsRead) };
}

export default function OperationsIndex({ loaderData }: Route.ComponentProps) {
  const { events, status } = useOperationsStream();

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

        <OperationsConsole events={events} status={status} />
      </Stack>
    </Container>
  );
}
