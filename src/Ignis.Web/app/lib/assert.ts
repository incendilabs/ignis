/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/** Marks a branch the types rule out, such as the `default` of an exhaustive switch; throws if reached anyway. */
export function assertNever(value: never): never {
  throw new Error(`Reached something that we thought was unreachable: ${JSON.stringify(value)}`);
}
