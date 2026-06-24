/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { buildResourceTree } from "./node";

describe("buildResourceTree", () => {
  it("walks top-level primitives in source order", () => {
    expect(buildResourceTree({ resourceType: "Patient", id: "1", active: true })).toEqual([
      { key: "resourceType", path: ["resourceType"], kind: "primitive", value: "Patient", children: [] },
      { key: "id", path: ["id"], kind: "primitive", value: "1", children: [] },
      { key: "active", path: ["active"], kind: "primitive", value: true, children: [] },
    ]);
  });

  it("walks nested objects, tracking the path", () => {
    const [, textNode] = buildResourceTree({
      resourceType: "Patient",
      text: { status: "generated" },
    });

    expect(textNode).toEqual({
      key: "text",
      path: ["text"],
      kind: "object",
      value: null,
      children: [
        { key: "status", path: ["text", "status"], kind: "primitive", value: "generated", children: [] },
      ],
    });
  });

  it("walks arrays, indexing children by position", () => {
    const [, nameNode] = buildResourceTree({
      resourceType: "Patient",
      name: [{ family: "Doe", given: ["Jane", "Q"] }],
    });

    expect(nameNode).toEqual({
      key: "name",
      path: ["name"],
      kind: "array",
      value: null,
      children: [
        {
          key: "0",
          path: ["name", "0"],
          kind: "object",
          value: null,
          children: [
            { key: "family", path: ["name", "0", "family"], kind: "primitive", value: "Doe", children: [] },
            {
              key: "given",
              path: ["name", "0", "given"],
              kind: "array",
              value: null,
              children: [
                { key: "0", path: ["name", "0", "given", "0"], kind: "primitive", value: "Jane", children: [] },
                { key: "1", path: ["name", "0", "given", "1"], kind: "primitive", value: "Q", children: [] },
              ],
            },
          ],
        },
      ],
    });
  });

  it("skips fields whose value is undefined", () => {
    expect(buildResourceTree({ resourceType: "Patient", id: undefined })).toEqual([
      { key: "resourceType", path: ["resourceType"], kind: "primitive", value: "Patient", children: [] },
    ]);
  });

  it("collapses null and unsupported values to a null primitive", () => {
    expect(buildResourceTree({ resourceType: "Patient", deceasedDateTime: null })).toEqual([
      { key: "resourceType", path: ["resourceType"], kind: "primitive", value: "Patient", children: [] },
      { key: "deceasedDateTime", path: ["deceasedDateTime"], kind: "primitive", value: null, children: [] },
    ]);
  });
});
