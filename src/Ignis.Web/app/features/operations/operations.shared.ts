/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/** Same-origin BFF endpoint that relays the operations hub over SSE. */
export const operationsStreamPath = "/admin/operations/stream";

export interface OperationProgressInfo {
  current: number;
  total: number;
}

export interface OperationStatistics {
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
}

/** A normalized operations-hub event, as relayed to the browser over SSE. */
export type OperationEvent =
  | { type: "progress"; operationId: string; message: string; progress?: OperationProgressInfo }
  | { type: "completed"; operationId: string; message: string; statistics?: OperationStatistics }
  | { type: "error"; operationId: string; message: string };

/** An event after the client tags it with a local id and receive time. */
export type StreamedOperationEvent = OperationEvent & {
  id: string;
  receivedAt: number;
};
