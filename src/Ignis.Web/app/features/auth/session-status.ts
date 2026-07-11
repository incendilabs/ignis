/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

export const SessionStatus = {
  Anonymous: "ANONYMOUS",
  Valid: "VALID",
  Expired: "EXPIRED",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];
