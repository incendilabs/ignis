/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { joinFhirUrl } from "./url";

describe("joinFhirUrl", () => {
  it("resolves an endpoint under a base with an explicit path", () => {
    expect(joinFhirUrl("https://api.example/fhir/", "Patient").toString())
      .toBe("https://api.example/fhir/Patient");
  });

  it("ensures a trailing slash on the base path", () => {
    expect(joinFhirUrl("https://api.example/fhir", "Patient").toString())
      .toBe("https://api.example/fhir/Patient");
  });

  it("treats a bare-origin base as /fhir/", () => {
    expect(joinFhirUrl("https://api.example", "Patient").toString())
      .toBe("https://api.example/fhir/Patient");
  });

  it("preserves an endpoint query string", () => {
    expect(joinFhirUrl("https://api.example/fhir/", "Patient?_summary=count").toString())
      .toBe("https://api.example/fhir/Patient?_summary=count");
  });

  it("resolves under a nested base path", () => {
    expect(joinFhirUrl("https://api.example/api/fhir/", "Observation").toString())
      .toBe("https://api.example/api/fhir/Observation");
  });

  it("accepts a URL instance as the base", () => {
    expect(joinFhirUrl(new URL("https://api.example/fhir/"), "metadata").toString())
      .toBe("https://api.example/fhir/metadata");
  });
});
