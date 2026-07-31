/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Lead } from "@eventuras/ratio-ui/core/Lead";
import { Container } from "@eventuras/ratio-ui/layout/Container";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { redirect } from "react-router";

import { fetchSupportedProfiles } from "#app/features/admin/profiles.server";
import { requireSession } from "#app/features/auth/session.server";
import { isEnabled } from "#app/features/resources-ui/config.server";
import { m } from "#app/i18n/paraglide/messages";

import type { Route } from "./+types/index";
import { ResourceValidator } from "../ResourceValidator";
import { validateResource } from "../validate.server";

export async function loader({ request }: Route.LoaderArgs) {
  if (!isEnabled()) return redirect("/");
  const session = await requireSession(request);

  // Loaded once for the whole flow; step 2 filters them by the resource type
  // that step 1 turned out to hold.
  const profiles = await fetchSupportedProfiles(request, session.tokens?.accessToken);
  return { profiles };
}

export async function action({ request }: Route.ActionArgs) {
  if (!isEnabled()) return { ok: false as const };
  const session = await requireSession(request);

  const form = await request.formData();
  const rawResource = form.get("resource");
  const resourceText = typeof rawResource === "string" ? rawResource : "";
  const profile = form.get("profile");

  return validateResource(
    request,
    session.tokens?.accessToken,
    resourceText,
    typeof profile === "string" ? profile : null,
    {
      invalidJson: m.validation_invalid_json(),
      notAResource: m.validation_not_a_resource(),
    },
  );
}

export default function ValidationPage({ loaderData }: Route.ComponentProps) {
  return (
    <Container as="main">
      <Stack direction="vertical" gap="lg">
        <Stack direction="vertical" gap="sm">
          <Heading as="h1">{m.validation_title()}</Heading>
          <Lead>{m.validation_description()}</Lead>
        </Stack>

        <ResourceValidator profiles={loaderData.profiles} />
      </Stack>
    </Container>
  );
}
