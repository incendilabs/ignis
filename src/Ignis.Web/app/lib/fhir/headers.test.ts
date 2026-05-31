/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { fhirHeaders } from "./headers";

describe("fhirHeaders", () => {
  it("always sets a FHIR-aware Accept header", () => {
    expect(fhirHeaders()).toEqual({
      Accept: "application/fhir+json, application/json",
    });
  });

  it("adds a bearer Authorization header when a token is supplied", () => {
    expect(fhirHeaders("abc123")).toEqual({
      Accept: "application/fhir+json, application/json",
      Authorization: "Bearer abc123",
    });
  });

  it("omits Authorization for an empty token", () => {
    expect(fhirHeaders("")).not.toHaveProperty("Authorization");
  });
});
