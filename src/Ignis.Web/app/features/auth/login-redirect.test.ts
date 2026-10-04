/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { loginUrl, redirectToLogin, requestedPage } from "./login-redirect";

const page = (path: string) => requestedPage(new URL(path, "https://ignis.test"));

describe("loginUrl", () => {
  it("carries the return target as an encoded query param", () => {
    expect(loginUrl("/resources?q=a b")).toBe("/auth/login?returnTo=%2Fresources%3Fq%3Da%20b");
  });
});

describe("requestedPage", () => {
  it("keeps a page path and its query", () => {
    expect(page("/admin/database?tab=indexes")).toBe("/admin/database?tab=indexes");
  });

  it("strips the single-fetch suffix a client navigation adds", () => {
    expect(page("/admin/database.data")).toBe("/admin/database");
  });

  it("maps the root payload back to the root", () => {
    expect(page("/_root.data")).toBe("/");
  });

  it("drops the routes param, keeping the page's own query", () => {
    expect(page("/resources.data?_routes=routes%2Fresources&type=Patient")).toBe(
      "/resources?type=Patient",
    );
  });
});

describe("redirectToLogin", () => {
  it("sends a client navigation back to the page, not to its payload", () => {
    const response = redirectToLogin(new Request("https://ignis.test/admin/database.data"));

    expect(response.headers.get("location")).toBe("/auth/login?returnTo=%2Fadmin%2Fdatabase");
  });
});
