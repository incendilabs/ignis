/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { isValidFhirResourceTypeName } from "./resource-type";

describe("isValidFhirResourceTypeName", () => {
  it("accepts base spec resource type names", () => {
    expect(isValidFhirResourceTypeName("Patient")).toBe(true);
    expect(isValidFhirResourceTypeName("CarePlan")).toBe(true);
    expect(isValidFhirResourceTypeName("MedicationRequest")).toBe(true);
  });

  it("accepts custom resource type names with digits and underscores (sdf-0)", () => {
    expect(isValidFhirResourceTypeName("MyResource2")).toBe(true);
    expect(isValidFhirResourceTypeName("Custom_Resource")).toBe(true);
    expect(isValidFhirResourceTypeName("V2Message")).toBe(true);
  });

  it("rejects names that do not start with an uppercase letter", () => {
    expect(isValidFhirResourceTypeName("patient")).toBe(false);
    expect(isValidFhirResourceTypeName("2Patient")).toBe(false);
    expect(isValidFhirResourceTypeName("_Patient")).toBe(false);
    expect(isValidFhirResourceTypeName("")).toBe(false);
  });

  it("rejects names containing URL metacharacters", () => {
    expect(isValidFhirResourceTypeName("Patient?_count=1")).toBe(false);
    expect(isValidFhirResourceTypeName("Patient/123")).toBe(false);
    expect(isValidFhirResourceTypeName("Patient.Slice")).toBe(false);
    expect(isValidFhirResourceTypeName("Patient ")).toBe(false);
  });
});
