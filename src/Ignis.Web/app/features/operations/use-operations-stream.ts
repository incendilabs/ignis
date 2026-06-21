/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { useEffect, useState } from "react";

import {
  operationsStreamPath,
  type OperationEvent,
  type StreamedOperationEvent,
} from "./operations.shared";

export type StreamStatus = "connecting" | "live" | "offline";

/** Cap the in-memory log so a long-open page doesn't grow unbounded. */
const MAX_EVENTS = 500;

/**
 * Subscribes to the same-origin operations SSE relay and accumulates events.
 * The connection (and its cookie auth) is owned by the browser; the relay
 * forwards the API hub on the server side.
 */
export function useOperationsStream(): {
  events: StreamedOperationEvent[];
  status: StreamStatus;
} {
  const [events, setEvents] = useState<StreamedOperationEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");

  useEffect(() => {
    const source = new EventSource(operationsStreamPath);

    source.onopen = () => { setStatus("live"); };
    // EventSource reconnects on its own; surface the gap meanwhile.
    source.onerror = () => { setStatus("offline"); };
    source.onmessage = (message) => {
      let event: OperationEvent;
      try {
        event = JSON.parse(message.data as string) as OperationEvent;
      } catch {
        return;
      }
      setEvents((previous) => {
        const next = [...previous, { ...event, id: crypto.randomUUID(), receivedAt: Date.now() }];
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });
    };

    return () => { source.close(); };
  }, []);

  return { events, status };
}
