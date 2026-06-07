/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { isValidFhirId } from "./id";

describe("isValidFhirId", () => {
  it("accepts ids of letters, digits, hyphens, and dots", () => {
    expect(isValidFhirId("123")).toBe(true);
    expect(isValidFhirId("patient-1")).toBe(true);
    expect(isValidFhirId("c1c76e76-f9ef-e022-fbfb-b19c49bb1fdf")).toBe(true);
    expect(isValidFhirId("v1.2")).toBe(true);
  });

  it("rejects empty ids and ids longer than 64 characters", () => {
    expect(isValidFhirId("")).toBe(false);
    expect(isValidFhirId("a".repeat(65))).toBe(false);
  });

  it("rejects ids containing URL metacharacters", () => {
    expect(isValidFhirId("patient/1")).toBe(false);
    expect(isValidFhirId("1?_summary=count")).toBe(false);
    expect(isValidFhirId("has space")).toBe(false);
    expect(isValidFhirId("under_score")).toBe(false);
  });
});
