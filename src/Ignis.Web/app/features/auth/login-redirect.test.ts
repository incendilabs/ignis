/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { loginUrl } from "./login-redirect";

describe("loginUrl", () => {
  it("carries the return target as an encoded query param", () => {
    expect(loginUrl("/resources?q=a b")).toBe("/auth/login?returnTo=%2Fresources%3Fq%3Da%20b");
  });
});
