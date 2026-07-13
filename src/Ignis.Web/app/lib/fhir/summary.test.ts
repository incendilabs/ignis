/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { resourceStatus, resourceTitle, summaryFields } from "./summary";

describe("resourceTitle", () => {
  it("prefers title, then a string name", () => {
    expect(resourceTitle({ title: "PHQ-9", name: "Phq9" })).toBe("PHQ-9");
    expect(resourceTitle({ name: "Phq9" })).toBe("Phq9");
  });

  it("ignores non-string and empty candidates", () => {
    expect(resourceTitle({ name: [{ family: "Doe" }] })).toBeNull();
    expect(resourceTitle({ title: "" })).toBeNull();
    expect(resourceTitle({})).toBeNull();
  });
});

describe("resourceStatus", () => {
  it("returns the status code when it is a non-empty string", () => {
    expect(resourceStatus({ status: "active" })).toBe("active");
    expect(resourceStatus({ status: "" })).toBeNull();
    expect(resourceStatus({ status: { coding: [] } })).toBeNull();
    expect(resourceStatus({})).toBeNull();
  });
});

describe("summaryFields", () => {
  it("keeps top-level primitives in source order, skipping complex fields", () => {
    expect(
      summaryFields({
        resourceType: "Questionnaire",
        id: "phq-9",
        meta: { versionId: "1" },
        status: "active",
        item: [{ linkId: "1" }],
        experimental: false,
        version: 2,
      }),
    ).toEqual([
      { label: "resourceType", value: "Questionnaire" },
      { label: "id", value: "phq-9" },
      { label: "status", value: "active" },
      { label: "experimental", value: "false" },
      { label: "version", value: "2" },
    ]);
  });

  it("skips empty strings and nulls", () => {
    expect(summaryFields({ title: "", note: null })).toEqual([]);
  });
});
