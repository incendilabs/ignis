/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { HubConnectionBuilder } from "@microsoft/signalr";

import { env } from "#app/env.server";
import { Logger } from "#app/logger";

import type {
  OperationEvent,
  OperationProgressInfo,
  OperationStatistics,
} from "./operations.shared";

const logger = Logger.create({ namespace: "operations:stream" });

const KEEPALIVE_MS = 25_000;

/** Wire shape of the hub's `Completed` summary argument (SignalR sends camelCase). */
interface OperationSummaryPayload {
  message: string;
  statistics?: OperationStatistics | null;
}

/**
 * Opens a server-side SignalR connection to the API operations hub using the
 * caller's access token, and relays its events to the browser over SSE. The
 * token stays on the server — the browser only talks to this same-origin
 * endpoint with its session cookie.
 */
export function streamOperationEvents(request: Request, accessToken: string): Response {
  const hubUrl = resolveHubUrl(request);
  const connection = new HubConnectionBuilder()
    .withUrl(hubUrl, { accessTokenFactory: () => accessToken })
    .withAutomaticReconnect()
    .build();

  const encoder = new TextEncoder();
  let closed = false;
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  // Shared teardown, reachable from both start() (abort/close/error) and the
  // stream's cancel(), so the keep-alive timer never outlives the stream.
  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (keepAlive) clearInterval(keepAlive);
    void connection.stop();
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: OperationEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const close = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Stream already closed.
        }
      };

      connection.on(
        "Progress",
        (operationId: string, message: string, progress: OperationProgressInfo | null) => {
          send({ type: "progress", operationId, message, progress: progress ?? undefined });
        },
      );
      connection.on("Completed", (operationId: string, summary: OperationSummaryPayload) => {
        send({
          type: "completed",
          operationId,
          message: summary.message,
          statistics: summary.statistics ?? undefined,
        });
      });
      connection.on("Error", (operationId: string, message: string) => {
        send({ type: "error", operationId, message });
      });
      connection.onclose(() => { close(); });

      request.signal.addEventListener("abort", close);

      // Comment lines keep idle proxies (tunnels, load balancers) from dropping
      // the connection; harmless before the hub is even connected.
      keepAlive = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": ping\n\n"));
      }, KEEPALIVE_MS);

      try {
        await connection.start();
      } catch (error) {
        logger.warn({ error }, "Failed to connect to the operations hub");
        cleanup();
        try {
          controller.error(error);
        } catch {
          // noop
        }
      }
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** The operations hub lives on the API origin (not under `/fhir`). */
function resolveHubUrl(request: Request): string {
  const base = env("IGNIS_WEB_FHIR_BASE_URL", { default: "" });
  const origin = base === "" ? new URL(request.url).origin : new URL(base).origin;
  return new URL("/hubs/operations", origin).toString();
}
