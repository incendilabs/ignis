/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";

import type { OperationResult } from "../maintenance.shared";

export function OperationResultPanel({ result }: { result: OperationResult; }) {
  return (
    <Panel
      variant={result.ok ? "callout" : "alert"}
      status={result.ok ? "success" : "error"}
    >
      <Stack direction="vertical" gap="xs">
        <Text>{result.message}</Text>
        {result.operationId ? (
          <Text size="sm">
            Operation ID: {result.operationId}
          </Text>
        ) : null}
      </Stack>
    </Panel>
  );
}
