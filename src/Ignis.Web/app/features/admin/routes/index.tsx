/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Badge } from "@eventuras/ratio-ui/core/Badge";
import { Unauthorized } from "@eventuras/ratio-ui/blocks/Unauthorized";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { getSessionFromRequest } from "@/features/auth/session.server";
import { m } from "@/i18n/paraglide/messages";

import type { Route } from "./+types/index";
import { isEnabled } from "../config.server";
import { scopes } from "../scopes";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await getSessionFromRequest(request);
  if (session === null) return redirect("/auth/login");
  const grantedScopes = session.scopes ?? [];
  const isAuthorized = grantedScopes.includes(scopes.operationsRead);
  return { isAuthorized, scopes: grantedScopes };
}

export default function AdminIndex({ loaderData }: Route.ComponentProps) {
  if (!loaderData.isAuthorized) {
    return <Unauthorized />;
  }
  return (
    <main className="container mx-auto p-6">
      <h1 className="text-3xl">{m.admin_title()}</h1>
      <p className="mt-4">{m.admin_signed_in()}</p>
      <Stack direction="horizontal" gap="sm">
        {loaderData.scopes.map((scope) => (
          <Badge key={scope}>{scope}</Badge>
        ))}
      </Stack>
    </main>
  );
}
