/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { parseLinkList } from "./link-list";

const parse = (spec: unknown, locale = "en") =>
  parseLinkList(typeof spec === "string" ? spec : JSON.stringify(spec), locale, "en");

describe("parseLinkList", () => {
  it("reads a label for the requested locale", () => {
    const spec = [{ href: "/pages/terms", label: { en: "Terms of use", nb: "Vilkår" } }];

    expect(parse(spec, "nb")).toEqual([
      { label: "Vilkår", href: "/pages/terms", external: false },
    ]);
  });

  it("falls back to the base locale when a translation is missing", () => {
    const spec = [{ href: "/pages/terms", label: { en: "Terms of use" } }];

    expect(parse(spec, "nb")).toEqual([
      { label: "Terms of use", href: "/pages/terms", external: false },
    ]);
  });

  it("reads an href that differs by language", () => {
    const spec = [
      { href: { en: "https://example.com/help", nb: "https://example.no/hjelp" }, label: "Help" },
    ];

    expect(parse(spec, "nb")).toEqual([
      { label: "Help", href: "https://example.no/hjelp", external: true },
    ]);
  });

  it("falls back to the base locale for an href too", () => {
    const spec = [{ href: { en: "/pages/terms" }, label: "Terms" }];

    expect(parse(spec, "nb")[0]?.href).toBe("/pages/terms");
  });

  it("uses a plain-string label in every language", () => {
    const spec = [{ href: "https://github.com/incendilabs/ignis", label: "GitHub" }];

    expect(parse(spec, "nb")).toEqual([
      { label: "GitHub", href: "https://github.com/incendilabs/ignis", external: true },
    ]);
  });

  it("keeps the order the deployment configured", () => {
    const spec = [
      { href: "/b", label: "B" },
      { href: "/a", label: "A" },
    ];

    expect(parse(spec).map((link) => link.href)).toEqual(["/b", "/a"]);
  });

  it.each([
    { label: "No href" },
    { href: "/pages/terms" },
    { href: "/pages/terms", label: {} },
    { href: "  ", label: "Blank" },
    "not an object",
  ])("skips %j", (entry) => {
    expect(parse([entry])).toEqual([]);
  });

  it("keeps the valid entries when one is malformed", () => {
    const spec = [{ href: "/a", label: "A" }, { label: "no href" }, { href: "/b", label: "B" }];

    expect(parse(spec)).toHaveLength(2);
  });

  it.each(["", "   "])("yields nothing for %j", (spec) => {
    expect(parse(spec)).toEqual([]);
  });

  it("yields nothing for JSON that isn't an array", () => {
    expect(parse('{"href":"/a"}')).toEqual([]);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "//evil.example.com",
  ])("skips the scriptable href %j", (href) => {
    expect(parse([{ href, label: "Click" }])).toEqual([]);
  });

  it("skips a scriptable href per locale, keeping the safe ones", () => {
    const spec = [
      { href: { en: "/pages/terms", nb: "javascript:alert(1)" }, label: "Terms" },
    ];

    expect(parse(spec, "en")).toHaveLength(1);
    expect(parse(spec, "nb")).toEqual([]);
  });

  it("throws on JSON it cannot parse, rather than quietly rendering no footer", () => {
    expect(() => parse("[{href: /pages/terms}]")).toThrow();
  });
});
