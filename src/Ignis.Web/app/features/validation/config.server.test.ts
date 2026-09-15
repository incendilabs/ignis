/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { allowsAnonymous, isEnabled, sessionRequirement } from "./config.server";

describe("validation feature flags", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off when neither the resource browser nor anonymous validation is enabled", () => {
    expect(isEnabled()).toBe(false);
    expect(allowsAnonymous()).toBe(false);
  });

  it("follows the resource browser for signed-in deployments", () => {
    vi.stubEnv("IGNIS_WEB_FEATURES_AUTH", "true");
    vi.stubEnv("IGNIS_WEB_FEATURES_RESOURCES_UI", "true");

    expect(isEnabled()).toBe(true);
    expect(allowsAnonymous()).toBe(false);
  });

  it("stands on its own when anonymous validation is enabled, with auth off entirely", () => {
    vi.stubEnv("IGNIS_WEB_FEATURES_VALIDATION_ANONYMOUS", "true");

    expect(isEnabled()).toBe(true);
    expect(allowsAnonymous()).toBe(true);
  });
});

describe("sessionRequirement", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("demands a session where validation is not open to everyone", () => {
    vi.stubEnv("IGNIS_WEB_FEATURES_AUTH", "true");
    vi.stubEnv("IGNIS_WEB_FEATURES_RESOURCES_UI", "true");

    expect(sessionRequirement()).toBe("required");
  });

  it("reads an optional session when anonymous validation runs alongside auth", () => {
    vi.stubEnv("IGNIS_WEB_FEATURES_AUTH", "true");
    vi.stubEnv("IGNIS_WEB_FEATURES_VALIDATION_ANONYMOUS", "true");

    expect(sessionRequirement()).toBe("optional");
  });

  it("never reads a session with auth off — there is none, and parsing one needs a secret", () => {
    vi.stubEnv("IGNIS_WEB_FEATURES_VALIDATION_ANONYMOUS", "true");

    expect(sessionRequirement()).toBe("none");
  });
});
