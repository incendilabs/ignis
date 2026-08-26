/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import {
  extensionValue,
  extensionValueType,
  findExtension,
  parseExtensions,
} from "./extension";

describe("parseExtensions", () => {
  it("returns [] for anything that is not an array", () => {
    expect(parseExtensions(undefined)).toEqual([]);
    expect(parseExtensions({ url: "http://example.test/x" })).toEqual([]);
    expect(parseExtensions("nonsense")).toEqual([]);
  });

  it("drops entries without a string url", () => {
    expect(parseExtensions([{ valueString: "orphan" }, { url: 42 }, null])).toEqual([]);
  });

  it("keeps the url and whichever value[x] was used", () => {
    const extensions = parseExtensions([
      { url: "http://example.test/score", valueInteger: 3 },
      { url: "http://example.test/label", valueString: "High" },
    ]);

    expect(extensions).toEqual([
      { url: "http://example.test/score", valueInteger: 3 },
      { url: "http://example.test/label", valueString: "High" },
    ]);
  });

  it("keeps a value[x] the model does not know about", () => {
    const [extension] = parseExtensions([
      { url: "http://example.test/period", valuePeriod: { start: "2026-01-01" } },
    ]);

    expect(extension.valuePeriod).toEqual({ start: "2026-01-01" });
  });

  it("parses nested extensions recursively", () => {
    const [extension] = parseExtensions([
      {
        url: "http://example.test/parent",
        extension: [
          { url: "http://example.test/child", valueString: "inner" },
          { valueString: "no url, dropped" },
        ],
      },
    ]);

    expect(extension.extension).toEqual([
      { url: "http://example.test/child", valueString: "inner" },
    ]);
  });

  it("omits the extension key when there are no valid children", () => {
    const [extension] = parseExtensions([
      { url: "http://example.test/parent", extension: [{ valueString: "no url" }] },
    ]);

    expect(extension).not.toHaveProperty("extension");
  });
});

describe("extensionValue", () => {
  it("returns the value[x] field that was used", () => {
    const [extension] = parseExtensions([
      { url: "http://example.test/x", valueBoolean: false },
    ]);

    expect(extensionValue(extension)).toEqual({ field: "valueBoolean", value: false });
  });

  it("finds a value[x] the model does not know about", () => {
    const [extension] = parseExtensions([
      { url: "http://example.test/x", valueCodeableConcept: { coding: [{ code: "a" }] } },
    ]);

    expect(extensionValue(extension)?.field).toBe("valueCodeableConcept");
  });

  it("returns undefined when the extension only nests others", () => {
    const [extension] = parseExtensions([
      {
        url: "http://example.test/parent",
        extension: [{ url: "http://example.test/child", valueString: "inner" }],
      },
    ]);

    expect(extensionValue(extension)).toBeUndefined();
  });

  it("ignores url and extension, which are not value[x]", () => {
    const [extension] = parseExtensions([{ url: "http://example.test/valueish" }]);

    expect(extensionValue(extension)).toBeUndefined();
  });
});

describe("extensionValueType", () => {
  it("strips the value prefix and lowercases the first letter", () => {
    expect(extensionValueType("valueBoolean")).toBe("boolean");
    expect(extensionValueType("valueCodeableConcept")).toBe("codeableConcept");
  });
});

describe("findExtension", () => {
  const extensions = parseExtensions([
    { url: "http://example.test/a", valueString: "first" },
    { url: "http://example.test/b", valueString: "second" },
    { url: "http://example.test/a", valueString: "duplicate" },
  ]);

  it("returns the first match", () => {
    expect(findExtension(extensions, "http://example.test/a")?.valueString).toBe("first");
  });

  it("returns undefined for an unknown url or missing list", () => {
    expect(findExtension(extensions, "http://example.test/missing")).toBeUndefined();
    expect(findExtension(undefined, "http://example.test/a")).toBeUndefined();
  });
});
