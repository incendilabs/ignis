/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpStatus } from "#app/lib/fhir/http";

import { validateResource } from "./validate.server";

const accessToken = "test-token";
const localMessages = { invalidJson: "not json", notAResource: "not a resource" };
const patient = `{"resourceType":"Patient","active":true}`;

function request() {
  return new Request("https://web.example/validation");
}

function outcomeResponse(issue: unknown[], status: number) {
  return new Response(
    JSON.stringify({ resourceType: "OperationOutcome", issue }),
    { status, headers: { "Content-Type": "application/fhir+json" } },
  );
}

describe("validateResource", () => {
  beforeEach(() => {
    vi.stubEnv("IGNIS_WEB_FHIR_BASE_URL", "https://api.example/fhir/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // Spark's input formatter answers 400 with a real OperationOutcome when the body
  // does not parse, so those are findings — not a failed call.
  it("surfaces a rejected body as issues rather than a failed request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(outcomeResponse([
      {
        severity: "error",
        code: "value",
        details: { text: "string 'notabool' is not the right type of literal for a boolean." },
        expression: ["Patient.active"],
      },
      { severity: "error", diagnostics: "Body parsing failed" },
    ], HttpStatus.BadRequest));
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateResource(
      request(),
      accessToken,
      `{"resourceType":"Patient","active":"notabool"}`,
      null,
      localMessages,
    );

    expect(result).toEqual({
      ok: true,
      issues: [
        {
          severity: "error",
          code: "value",
          message: "string 'notabool' is not the right type of literal for a boolean.",
          expression: ["Patient.active"],
        },
        { severity: "error", code: null, message: "Body parsing failed", expression: [] },
      ],
    });
  });

  it("coerces every issue field the server did not send as a string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(outcomeResponse([
      { severity: { code: "error" }, code: 42, details: { text: ["nested"] } },
    ], HttpStatus.Ok));
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateResource(request(), accessToken, patient, null, localMessages);

    expect(result).toEqual({
      ok: true,
      issues: [{ severity: "information", code: null, message: "", expression: [] }],
    });
  });

  it("reports an error response carrying no outcome with its status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ type: "about:blank", title: "Bad Request", status: 400 }),
        { status: HttpStatus.BadRequest, headers: { "Content-Type": "application/problem+json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await validateResource(request(), accessToken, patient, null, localMessages))
      .toEqual({ ok: false, reason: "no-outcome", status: HttpStatus.BadRequest });
  });

  it("reports an empty 500 with its status rather than as unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    expect(await validateResource(request(), accessToken, patient, null, localMessages))
      .toEqual({ ok: false, reason: "no-outcome", status: 500 });
  });

  // A gateway can answer 2xx with an empty body or an HTML page; neither means "valid".
  it("reports a 2xx without an outcome rather than as no problems found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: HttpStatus.Ok })));

    expect(await validateResource(request(), accessToken, patient, null, localMessages))
      .toEqual({ ok: false, reason: "no-outcome", status: HttpStatus.Ok });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html><body>Sign in</body></html>", { status: HttpStatus.Ok, headers: { "Content-Type": "text/html" } }),
    ));

    expect(await validateResource(request(), accessToken, patient, null, localMessages))
      .toEqual({ ok: false, reason: "no-outcome", status: HttpStatus.Ok });
  });

  // Spark's error handler answers 500 with an OperationOutcome holding the exception text.
  it("reports an error outcome on a 5xx as a failed request, not as findings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(outcomeResponse([
      { severity: "error", diagnostics: "MongoConnectionException: timeout" },
    ], 500)));

    expect(await validateResource(request(), accessToken, patient, null, localMessages))
      .toEqual({ ok: false, reason: "error-outcome", status: 500, message: "MongoConnectionException: timeout" });
  });

  it("reports a failed fetch as unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    expect(await validateResource(request(), accessToken, patient, null, localMessages))
      .toEqual({ ok: false, reason: "unreachable" });
  });

  it("posts the pasted text unchanged, with the chosen profile as a query parameter", async () => {
    // A fresh Response per call — a body can only be read once.
    const fetchMock = vi.fn().mockImplementation(() => outcomeResponse([], HttpStatus.Ok));
    vi.stubGlobal("fetch", fetchMock);

    await validateResource(request(), accessToken, patient, null, localMessages);

    const [url, init] = fetchMock.mock.lastCall as [URL, RequestInit];
    expect(url.pathname).toBe("/fhir/Patient/$validate");
    expect(url.searchParams.has("profile")).toBe(false);
    expect(init.method).toBe("POST");
    // Re-serializing would lose the syntax the server's parser reports on.
    expect(init.body).toBe(patient);

    const profile = "https://example.org/StructureDefinition/MyPatient";
    await validateResource(request(), accessToken, patient, profile, localMessages);

    const [pinned] = fetchMock.mock.lastCall as [URL];
    expect(pinned.searchParams.get("profile")).toBe(profile);
  });
});
