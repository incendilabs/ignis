/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { parseHeadScripts } from "./head-scripts";

const parse = (spec: unknown) =>
  parseHeadScripts(typeof spec === "string" ? spec : JSON.stringify(spec));

describe("parseHeadScripts", () => {
  it("reads the Umami tag", () => {
    expect(
      parse([
        { src: "https://umami.example.com/script.js", defer: true, "data-website-id": "abc" },
      ]),
    ).toEqual([
      {
        src: "https://umami.example.com/script.js",
        attributes: { defer: true, "data-website-id": "abc" },
      },
    ]);
  });

  it("reads more than one tracker at once", () => {
    const scripts = parse([
      { src: "https://umami.example.com/script.js", defer: true },
      { src: "https://plausible.example.com/js/script.js", defer: true, "data-domain": "x.no" },
    ]);

    expect(scripts.map((script) => script.src)).toEqual([
      "https://umami.example.com/script.js",
      "https://plausible.example.com/js/script.js",
    ]);
  });

  it("keeps the script attributes it knows", () => {
    const [script] = parse([
      {
        src: "/local.js",
        async: true,
        type: "module",
        integrity: "sha384-abc",
        crossorigin: "anonymous",
        referrerpolicy: "no-referrer",
      },
    ]);

    expect(script.attributes).toEqual({
      async: true,
      type: "module",
      integrity: "sha384-abc",
      crossOrigin: "anonymous",
      referrerPolicy: "no-referrer",
    });
  });

  it("hands React the prop names it knows", () => {
    const [script] = parse([
      { src: "/a.js", nomodule: true, crossorigin: "use-credentials", referrerpolicy: "origin" },
    ]);

    expect(script.attributes).toEqual({
      noModule: true,
      crossOrigin: "use-credentials",
      referrerPolicy: "origin",
    });
  });

  it("leaves data attributes as written", () => {
    const [script] = parse([{ src: "/a.js", "data-website-id": "abc", "data-exclude-search": "true" }]);

    expect(script.attributes).toEqual({
      "data-website-id": "abc",
      "data-exclude-search": "true",
    });
  });

  it.each(["onload", "onerror", "innerHTML", "dangerouslySetInnerHTML", "content", "children"])(
    "drops the attribute %j",
    (name) => {
      const [script] = parse([{ src: "/a.js", [name]: "alert(1)" }]);

      expect(script.attributes).toEqual({});
    },
  );

  it("only treats a boolean attribute as set when it is true", () => {
    const [script] = parse([{ src: "/a.js", defer: false, async: "yes" }]);

    expect(script.attributes).toEqual({});
  });

  it.each([
    "javascript:alert(1)",
    "data:text/javascript,alert(1)",
    "//evil.example.com/x.js",
    "vbscript:msgbox(1)",
    "",
    "   ",
  ])("skips the src %j", (src) => {
    expect(parse([{ src, defer: true }])).toEqual([]);
  });

  it.each([[{ defer: true }], ["not an object"], [["nested"]]])(
    "skips the malformed entry %j",
    (entry) => {
      expect(parse([entry])).toEqual([]);
    },
  );

  it("keeps the valid entries when one is malformed", () => {
    expect(parse([{ src: "/a.js" }, { defer: true }, { src: "/b.js" }])).toHaveLength(2);
  });

  it.each(["", "   ", '{"src":"/a.js"}'])("yields nothing for %j", (spec) => {
    expect(parse(spec)).toEqual([]);
  });

  it("throws on JSON it cannot parse", () => {
    expect(() => parse("[{src: /a.js}]")).toThrow();
  });
});
