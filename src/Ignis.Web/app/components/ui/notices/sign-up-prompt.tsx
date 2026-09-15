/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Link } from "@eventuras/ratio-ui/core/Link";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { useLocation } from "react-router";

import { loginUrl } from "#app/features/auth/login-redirect";
import { m } from "#app/i18n/paraglide/messages";

/** For visitors on an open page without a session: what a login adds, and a way in
 *  that returns them here. */
export function SignUpPrompt() {
  const location = useLocation();

  return (
    <Panel variant="callout" status="info">
      <Stack direction="vertical" gap="sm" align="start">
        <Text weight="bold">{m.signup_prompt_title()}</Text>
        <Text>{m.signup_prompt_body()}</Text>
        <Link href={loginUrl(location.pathname + location.search)} variant="button-primary">
          {m.signup_prompt_action()}
        </Link>
      </Stack>
    </Panel>
  );
}
