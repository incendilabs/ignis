/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { env, envBool } from "./env.server";

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the value when set", () => {
    vi.stubEnv("FOO", "bar");
    expect(env("FOO")).toBe("bar");
  });

  it("trims whitespace around the value", () => {
    vi.stubEnv("FOO", "  bar  ");
    expect(env("FOO")).toBe("bar");
  });

  it("throws when the variable is unset and no default is given", () => {
    vi.stubEnv("FOO", undefined);
    expect(() => env("FOO")).toThrow(/Missing required env var: FOO/);
  });

  it("throws when the variable is empty and no default is given", () => {
    vi.stubEnv("FOO", "");
    expect(() => env("FOO")).toThrow(/Missing required env var: FOO/);
  });

  it("returns the default when the variable is unset", () => {
    vi.stubEnv("FOO", undefined);
    expect(env("FOO", { default: "fallback" })).toBe("fallback");
  });

  it("returns the default when the variable is an empty string", () => {
    vi.stubEnv("FOO", "");
    expect(env("FOO", { default: "fallback" })).toBe("fallback");
  });
});

describe("envBool", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["true", true],
    ["1", true],
    ["false", false],
    ["0", false],
  ] as const)("parses %s as %s", (input, expected) => {
    vi.stubEnv("FOO", input);
    expect(envBool("FOO")).toBe(expected);
  });

  it("trims whitespace around the value", () => {
    vi.stubEnv("FOO", "  true  ");
    expect(envBool("FOO")).toBe(true);
  });

  it("throws on unrecognized values", () => {
    vi.stubEnv("FOO", "yes");
    expect(() => envBool("FOO")).toThrow(/Invalid boolean env var FOO/);
  });

  it("throws when the variable is unset and no default is given", () => {
    vi.stubEnv("FOO", undefined);
    expect(() => envBool("FOO")).toThrow(/Missing required env var: FOO/);
  });

  it("throws when the variable is empty and no default is given", () => {
    vi.stubEnv("FOO", "");
    expect(() => envBool("FOO")).toThrow(/Missing required env var: FOO/);
  });

  it("returns the default when the variable is unset", () => {
    vi.stubEnv("FOO", undefined);
    expect(envBool("FOO", { default: false })).toBe(false);
  });

  it("returns the default when the variable is an empty string", () => {
    vi.stubEnv("FOO", "");
    expect(envBool("FOO", { default: true })).toBe(true);
  });
});
