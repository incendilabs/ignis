/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Text } from "@eventuras/ratio-ui/core/Text";
import { Console, type ConsoleLevel } from "@eventuras/ratio-ui/console";

import { m } from "#app/i18n/paraglide/messages";

import type { StreamedOperationEvent } from "../operations.shared";
import type { StreamStatus } from "../use-operations-stream";

/**
 * Presentational live console of operations-hub events. The caller owns the
 * stream (via {@link useOperationsStream}) so the connection can be opened on
 * page load — before an operation starts — and passes events/status in. Pass
 * `filterOperationId` to scope the view to a single operation (e.g. the id
 * returned by an archive import).
 */
export function OperationsConsole({
  events,
  status,
  filterOperationId,
}: {
  events: StreamedOperationEvent[];
  status: StreamStatus;
  filterOperationId?: string;
}) {
  const live = status === "live";
  const shown = filterOperationId === undefined
    ? events
    : events.filter((event) => event.operationId === filterOperationId);

  return (
    <Console theme="dark" aria-label={m.operations_console_title()}>
      <Console.TitleBar>
        <Console.Title>{m.operations_console_title()}</Console.Title>
        <Console.LiveIndicator status={live ? "live" : "paused"}>
          {live ? m.operations_status_live() : m.operations_status_offline()}
        </Console.LiveIndicator>
        <Console.Counter>
          <b>{shown.length}</b> {m.operations_console_events()}
        </Console.Counter>
      </Console.TitleBar>
      <Console.Body>
        {shown.length === 0 ? (
          <Text>{m.operations_console_empty()}</Text>
        ) : (
          shown.map((event) => (
            <Console.Entry
              key={event.id}
              timestamp={clockLabel(event.receivedAt)}
              level={levelFor(event)}
              message={messageFor(event)}
            />
          ))
        )}
      </Console.Body>
    </Console>
  );
}

/** Local 24-hour clock time (seconds precision) in the runtime locale. */
function clockLabel(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function levelFor(event: StreamedOperationEvent): ConsoleLevel {
  switch (event.type) {
    case "completed":
      return "success";
    case "error":
      return "error";
    default:
      return "info";
  }
}

function messageFor(event: StreamedOperationEvent): string {
  if (event.type === "progress" && event.progress) {
    return `${event.message} (${String(event.progress.current)}/${String(event.progress.total)})`;
  }
  return event.message;
}
