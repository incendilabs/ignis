/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { createEncryptedJWT } from "@eventuras/fides-auth";
import type { Session } from "@eventuras/fides-auth/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionCookie } from "./cookies.server";
import { getSessionFromRequest, getSessionStateFromRequest } from "./session.server";
import { SessionStatus } from "./session-status";

// 32-byte key as hex, required by fides-auth's A256GCM session envelope.
const SECRET = "0".repeat(64);

/** Minimal unsigned JWT carrying only an `exp` claim, which is all the
 *  validator decodes to compute time-to-expiry. */
function accessTokenExpiringIn(seconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + seconds;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${header}.${payload}.`;
}

async function requestWithSession(session: Session): Promise<Request> {
  const jwt = await createEncryptedJWT(session, SECRET);
  const setCookie = await sessionCookie.serialize(jwt);
  const cookie = setCookie.split(";")[0]; // strip attributes, keep name=value
  return new Request("https://app.example/", { headers: { Cookie: cookie } });
}

function sessionWith(accessToken: string): Session {
  return {
    tokens: { accessToken },
    user: { name: "Leo Losen", email: "leo@example.com" },
    scopes: ["openid"],
  };
}

describe("getSessionStateFromRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports ANONYMOUS when no session cookie is present", async () => {
    vi.stubEnv("IGNIS_WEB_SESSION_SECRET", SECRET);
    const request = new Request("https://app.example/");

    const state = await getSessionStateFromRequest(request);

    expect(state.status).toBe("ANONYMOUS");
    expect(state.session).toBeNull();
  });

  it("reports VALID with the user while the access token is live", async () => {
    vi.stubEnv("IGNIS_WEB_SESSION_SECRET", SECRET);
    const request = await requestWithSession(sessionWith(accessTokenExpiringIn(3600)));

    const state = await getSessionStateFromRequest(request);

    expect(state.status).toBe(SessionStatus.Valid);
    expect(state.session?.user?.email).toBe("leo@example.com");
    expect(state.accessTokenExpiresIn ?? 0).toBeGreaterThan(0);
  });

  it("reports EXPIRED but keeps the session once the access token has lapsed", async () => {
    vi.stubEnv("IGNIS_WEB_SESSION_SECRET", SECRET);
    const request = await requestWithSession(sessionWith(accessTokenExpiringIn(-10)));

    const state = await getSessionStateFromRequest(request);

    expect(state.status).toBe("EXPIRED");
    expect(state.session?.user?.name).toBe("Leo Losen");
  });
});

describe("getSessionFromRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the session only while the access token is valid", async () => {
    vi.stubEnv("IGNIS_WEB_SESSION_SECRET", SECRET);
    const request = await requestWithSession(sessionWith(accessTokenExpiringIn(3600)));

    expect(await getSessionFromRequest(request)).not.toBeNull();
  });

  it("returns null once the access token has expired, gating privileged calls", async () => {
    vi.stubEnv("IGNIS_WEB_SESSION_SECRET", SECRET);
    const request = await requestWithSession(sessionWith(accessTokenExpiringIn(-10)));

    expect(await getSessionFromRequest(request)).toBeNull();
  });
});
