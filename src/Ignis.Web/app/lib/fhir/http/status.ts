/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/** Named HTTP status codes used by the FHIR client and its callers. */
export const HttpStatus = {
  Ok: 200,
  Accepted: 202,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  ContentTooLarge: 413,
  TooManyRequests: 429,
  ServiceUnavailable: 503,
} as const;

export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];
