/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { assertNever } from "./assert";

describe("assertNever", () => {
  it("throws with the value when reached at runtime", () => {
    expect(() => assertNever("oops" as never)).toThrow(/unreachable: "oops"/i);
  });
});
