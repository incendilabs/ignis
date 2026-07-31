/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { asString, asStringArray, isObject } from "./guards";

describe("isObject", () => {
  it("accepts keyed objects only", () => {
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject({})).toBe(true);
  });

  // Arrays are the trap: `typeof [] === "object"`.
  it("rejects arrays, null and primitives", () => {
    expect(isObject(["a"])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject("a")).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});

describe("asString", () => {
  it("passes strings through and rejects everything else", () => {
    expect(asString("a")).toBe("a");
    expect(asString("")).toBe("");
    expect(asString(42)).toBeUndefined();
    expect(asString(["a"])).toBeUndefined();
    expect(asString(null)).toBeUndefined();
  });
});

describe("asStringArray", () => {
  it("keeps the string entries of an array", () => {
    expect(asStringArray(["a", "b"])).toEqual(["a", "b"]);
    expect(asStringArray(["a", 42, null, ["b"], { c: 1 }])).toEqual(["a"]);
    expect(asStringArray([])).toEqual([]);
  });

  // The callers go straight on to .filter/.join, so a non-array must not pass through.
  it("returns an array for values that are not arrays", () => {
    expect(asStringArray("http://example.org/StructureDefinition/X")).toEqual([]);
    expect(asStringArray({ 0: "a" })).toEqual([]);
    expect(asStringArray(undefined)).toEqual([]);
    expect(asStringArray(null)).toEqual([]);
  });
});
