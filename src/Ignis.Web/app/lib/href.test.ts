/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { isExternalHref, isSafeHref } from "./href";

describe("isExternalHref", () => {
  it.each([
    "https://example.com",
    "http://example.com",
    "mailto:info@incendi.no",
    "tel:+4712345678",
    "//cdn.example.com/a.png",
  ])("treats %s as external", (href) => {
    expect(isExternalHref(href)).toBe(true);
  });

  it.each(["/pages/terms", "terms.md", "./terms.md", "#cookies", ""])(
    "treats %j as local",
    (href) => {
      expect(isExternalHref(href)).toBe(false);
    },
  );
});

describe("isSafeHref", () => {
  it.each([
    "https://example.com",
    "http://example.com",
    "mailto:info@incendi.no",
    "tel:+4712345678",
    "/pages/terms",
    "pages/terms",
    "#cookies",
    "",
  ])("allows %j", (href) => {
    expect(isSafeHref(href)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "//evil.example.com",
  ])("rejects %j", (href) => {
    expect(isSafeHref(href)).toBe(false);
  });
});
