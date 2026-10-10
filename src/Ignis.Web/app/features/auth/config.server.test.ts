/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { oauth } from "./config.server";

describe("oauth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requests identity, operations, and maintenance scopes", () => {
    stubRequiredEnv();

    expect(oauth().scope.split(" ")).toEqual([
      "openid",
      "profile",
      "email",
      "operations.read",
      "operations.import",
      "maintenance/database.write",
      "maintenance/database.destructive",
    ]);
  });

  it("builds the redirect URI from the app origin, ignoring a trailing slash", () => {
    stubRequiredEnv();
    vi.stubEnv("IGNIS_WEB_APP_URL", "https://app.example/");

    expect(oauth().redirect_uri).toBe("https://app.example/auth/callback");
  });
});

function stubRequiredEnv() {
  vi.stubEnv("IGNIS_AUTH_ISSUER", "https://issuer.example");
  vi.stubEnv("IGNIS_WEB_CLIENT_ID", "ignis-web");
  vi.stubEnv("IGNIS_WEB_CLIENT_SECRET", "secret");
  vi.stubEnv("IGNIS_WEB_APP_URL", "https://app.example");
}
