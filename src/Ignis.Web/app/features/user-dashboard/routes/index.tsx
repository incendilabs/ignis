/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Card } from "@eventuras/ratio-ui/core/Card";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { ValueTile } from "@eventuras/ratio-ui/core/ValueTile";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Grid } from "@eventuras/ratio-ui/layout/Grid";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { requireSession } from "#app/features/auth/session.server";
import { isEnabled } from "#app/features/resources-ui/config.server";
import {
  fetchResourceCount,
  fetchResourceTypes,
} from "#app/features/resources-ui/fhir-client.server";
import { m } from "#app/i18n/paraglide/messages";
import { mapWithConcurrency } from "#app/lib/concurrency";

import type { Route } from "./+types/index";

const COUNT_FETCH_CONCURRENCY = 8;

type GreetingSlot = "morning" | "afternoon" | "evening";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await requireSession(request);

  const hour = new Date().getHours();
  const greetingSlot: GreetingSlot =
    hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const userName = session.user?.name ?? null;

  const accessToken = session.tokens?.accessToken;
  const types = await fetchResourceTypes(request, accessToken);
  if (types === null) {
    return { ok: false as const, greetingSlot, userName };
  }

  const counts = await mapWithConcurrency(types, COUNT_FETCH_CONCURRENCY, (type) =>
    fetchResourceCount(request, accessToken, type),
  );
  const knownCounts = counts.filter((count): count is number => count !== null);

  return {
    ok: true as const,
    greetingSlot,
    userName,
    typeCount: types.length,
    countedTypes: knownCounts.length,
    instanceCount: knownCounts.length > 0 ? knownCounts.reduce((a, b) => a + b, 0) : null,
  };
}

const GREETINGS: Record<GreetingSlot, () => string> = {
  morning: m.dashboard_greeting_morning,
  afternoon: m.dashboard_greeting_afternoon,
  evening: m.dashboard_greeting_evening,
};

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const greeting = GREETINGS[loaderData.greetingSlot]();
  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Heading as="h1">
          {loaderData.userName ? `${greeting}, ${loaderData.userName}` : greeting}
        </Heading>

        {loaderData.ok ? (
          <Grid cols={{ sm: 2 }}>
            <Card>
              <ValueTile number={loaderData.typeCount} label={m.dashboard_stat_types()} />
            </Card>
            <Card>
              <ValueTile
                number={loaderData.instanceCount ?? "—"}
                label={m.dashboard_stat_instances()}
              >
                {loaderData.instanceCount !== null &&
                  loaderData.countedTypes < loaderData.typeCount && (
                    <ValueTile.Caption>
                      {m.dashboard_stat_instances_partial()}
                    </ValueTile.Caption>
                  )}
              </ValueTile>
            </Card>
          </Grid>
        ) : (
          <Panel variant="alert" status="error">
            <Text>{m.resources_capability_error()}</Text>
          </Panel>
        )}
      </Stack>
    </Container>
  );
}
