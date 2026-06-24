/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { formatPrimitive } from "./primitive";

describe("formatPrimitive", () => {
  it("stringifies non-empty values", () => {
    expect(formatPrimitive("completed")).toBe("completed");
    expect(formatPrimitive(42)).toBe("42");
  });

  it("keeps falsy-but-present values like 0 and false", () => {
    expect(formatPrimitive(0)).toBe("0");
    expect(formatPrimitive(false)).toBe("false");
  });

  it("returns null for empty values", () => {
    expect(formatPrimitive(null)).toBeNull();
    expect(formatPrimitive("")).toBeNull();
  });
});
