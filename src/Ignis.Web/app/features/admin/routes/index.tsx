/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Badge } from "@eventuras/ratio-ui/core/Badge";
import { Button } from "@eventuras/ratio-ui/core/Button";
import { Card } from "@eventuras/ratio-ui/core/Card";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Unauthorized } from "@eventuras/ratio-ui/blocks/Unauthorized";
import { AlertDialog } from "@eventuras/ratio-ui/layout/Dialog";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Grid } from "@eventuras/ratio-ui/layout/Grid";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { useState } from "react";
import { redirect, useFetcher } from "react-router";

import { getSessionFromRequest } from "@/features/auth/session.server";
import { m } from "@/i18n/paraglide/messages";

import type { Route } from "./+types/index";
import {
  getMaintenanceOperation,
  maintenanceOperations,
} from "../maintenance.shared";
import { OperationResultPanel } from "../components/OperationResultPanel";
import { isEnabled } from "../config.server";
import { requireScopedSession } from "../fhir-api.server";
import { getDatabaseConnectionStatus, runMaintenanceOperation } from "../maintenance.server";
import { scopes } from "../scopes";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await getSessionFromRequest(request);
  if (session === null) return redirect("/auth/login");
  const grantedScopes = session.scopes ?? [];
  const isAuthorized = grantedScopes.includes(scopes.operationsRead);

  if (!isAuthorized) {
    return {
      canClearStore: false,
      canRebuildIndex: false,
      databaseStatus: { ok: false as const, message: "" },
      isAuthorized: false,
      scopes: grantedScopes,
    };
  }

  const databaseStatus = await getDatabaseConnectionStatus(request);
  return {
    canClearStore: grantedScopes.includes(scopes.maintenanceDatabaseDestructive),
    canRebuildIndex: grantedScopes.includes(scopes.maintenanceDatabaseWrite),
    databaseStatus,
    isAuthorized,
    scopes: grantedScopes,
  };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isEnabled()) {
    return { ok: false, message: "Admin UI is disabled." };
  }

  const session = await getSessionFromRequest(request);

  const formData = await request.formData();
  const operation = getMaintenanceOperation(formData.get("intent"));
  if (operation === null) {
    return { ok: false, message: "Unknown maintenance action." };
  }

  const blocked = requireScopedSession(session, operation.requiredScope);
  if (blocked) return blocked;

  const accessToken = session?.tokens?.accessToken;
  if (!accessToken) {
    return {
      ok: false,
      message: "No access token was found in the current session.",
    };
  }

  return runMaintenanceOperation(request, operation, accessToken);
}

export default function AdminIndex({ loaderData }: Route.ComponentProps) {
  if (!loaderData.isAuthorized) {
    return <Unauthorized />;
  }

  const hasMaintenanceAccess = loaderData.canRebuildIndex || loaderData.canClearStore;

  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Heading as="h1">{m.admin_title()}</Heading>
          <Stack direction="horizontal" gap="sm" wrap>
            {loaderData.scopes.map((scope) => (
              <Badge key={scope}>{scope}</Badge>
            ))}
          </Stack>
        </Stack>

        <Card className="p-6">
          <Stack direction="vertical" gap="md">
            <Stack direction="vertical" gap="xs">
              <Heading as="h2">{m.admin_database_title()}</Heading>
              <Text>{m.admin_database_description()}</Text>
            </Stack>

            <Panel
              variant={loaderData.databaseStatus.ok ? "callout" : "alert"}
              status={loaderData.databaseStatus.ok ? "success" : "error"}
            >
              <Text>{loaderData.databaseStatus.message}</Text>
            </Panel>

            {hasMaintenanceAccess ? (
              <Grid cols={{ md: 2 }}>
                {loaderData.canRebuildIndex ? <RebuildIndexCard /> : null}
                {loaderData.canClearStore ? <ClearStoreCard /> : null}
              </Grid>
            ) : (
              <Panel variant="notice" status="info">
                <Text>{m.admin_database_no_operations()}</Text>
              </Panel>
            )}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

function RebuildIndexCard() {
  const fetcher = useFetcher<typeof action>();
  const result = fetcher.data;
  const isSubmitting = fetcher.state !== "idle";

  return (
    <Card className="p-6">
      <Stack direction="vertical" gap="md">
        <Stack direction="vertical" gap="sm">
          <Stack direction="horizontal" gap="sm" wrap align="center">
            <Heading as="h3" className="text-xl">
              {m.admin_database_rebuild_title()}
            </Heading>
          </Stack>
          <Text>{m.admin_database_rebuild_description()}</Text>
        </Stack>

        <fetcher.Form method="post">
          <input
            type="hidden"
            name="intent"
            value={maintenanceOperations.rebuildIndex.intent}
          />
          <Button type="submit" loading={isSubmitting} variant="primary">
            {m.admin_database_rebuild_button()}
          </Button>
        </fetcher.Form>

        {result ? <OperationResultPanel result={result} /> : null}
      </Stack>
    </Card>
  );
}

function ClearStoreCard() {
  const fetcher = useFetcher<typeof action>();
  const result = fetcher.data;
  const isSubmitting = fetcher.state !== "idle";
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const submitClearStore = () => {
    setIsDialogOpen(false);
    void fetcher.submit(
      { intent: maintenanceOperations.clearStore.intent },
      { method: "post" },
    );
  };

  return (
    <Card className="p-6">
      <Stack direction="vertical" gap="md">
        <Stack direction="vertical" gap="sm">
          <Stack direction="horizontal" gap="sm" wrap align="center">
            <Heading as="h3" className="text-xl">
              {m.admin_database_reset_title()}
            </Heading>
          </Stack>
          <Text>{m.admin_database_reset_description()}</Text>
        </Stack>

        <Button
          type="button"
          loading={isSubmitting}
          variant="danger"
          onClick={() => { setIsDialogOpen(true); }}
        >
          {m.admin_database_reset_button()}
        </Button>

        <AlertDialog
          isOpen={isDialogOpen}
          onClose={() => { setIsDialogOpen(false); }}
          variant="destructive"
          title={m.admin_database_reset_title()}
          primaryActionLabel={m.admin_database_reset_button()}
          cancelLabel={m.admin_database_reset_cancel()}
          confirmText="RESET"
          confirmLabel={m.admin_database_reset_confirm_label()}
          onPrimaryAction={submitClearStore}
        >
          <Text>{m.admin_database_reset_dialog_message()}</Text>
        </AlertDialog>

        {result ? <OperationResultPanel result={result} /> : null}
      </Stack>
    </Card>
  );
}

