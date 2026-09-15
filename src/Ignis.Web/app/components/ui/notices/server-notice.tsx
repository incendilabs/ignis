/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { Text } from "@eventuras/ratio-ui/core/Text";

import { m } from "#app/i18n/paraglide/messages";

/** The deployment's description of itself, shown before anyone pastes a record.
 *  Untranslated by design — it is the operator's wording, not ours. */
export function ServerNotice({ notice }: { notice: string | null; }) {
  if (notice === null) return null;

  return (
    <Panel variant="callout" status="warning">
      <Stack direction="vertical" gap="none">
        <Text weight="bold">{m.server_notice_title()}</Text>
        <Text>{notice}</Text>
      </Stack>
    </Panel>
  );
}
