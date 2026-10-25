/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpStatus } from "#app/lib/fhir/http";

import { EXPANSION_COUNT, expandValueSet, expandValueSets } from "./expand.server";

const accessToken = "test-token";

function request() {
  return new Request("https://web.example/resources/expansions");
}

function valueSetResponse(contains: unknown[], total?: number) {
  const expansion = total === undefined ? { contains } : { total, contains };
  return new Response(
    JSON.stringify({ resourceType: "ValueSet", expansion }),
    { status: HttpStatus.Ok, headers: { "Content-Type": "application/fhir+json" } },
  );
}

function codes(count: number) {
  return Array.from({ length: count }, (_, index) => ({ code: `c${String(index)}` }));
}

describe("expandValueSet", () => {
  beforeEach(() => {
    vi.stubEnv("IGNIS_WEB_FHIR_BASE_URL", "https://api.example/fhir/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls $expand with the url, version and count, and flattens the expansion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(valueSetResponse([
      { system: "http://loinc.org", code: "LA1", display: "Oriented" },
      { code: "LA2" },
    ]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await expandValueSet(request(), accessToken, "http://x/vs|1.0.0");

    const called = fetchMock.mock.calls[0][0] as URL;
    expect(called.pathname).toBe("/fhir/ValueSet/$expand");
    expect(called.searchParams.get("url")).toBe("http://x/vs");
    expect(called.searchParams.get("valueSetVersion")).toBe("1.0.0");
    expect(called.searchParams.get("count")).toBe(String(EXPANSION_COUNT));
    expect(result).toEqual({
      ok: true,
      truncated: false,
      choices: [
        { label: "Oriented", answer: { valueCoding: { system: "http://loinc.org", code: "LA1", display: "Oriented" } } },
        { label: "LA2", answer: { valueCoding: { code: "LA2" } } },
      ],
    });
  });

  it("omits valueSetVersion for an unversioned canonical", async () => {
    const fetchMock = vi.fn().mockResolvedValue(valueSetResponse([{ code: "a" }]));
    vi.stubGlobal("fetch", fetchMock);

    await expandValueSet(request(), accessToken, "http://x/vs");

    const called = fetchMock.mock.calls[0][0] as URL;
    expect(called.searchParams.has("valueSetVersion")).toBe(false);
  });

  it("reports a truncated expansion from expansion.total", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(valueSetResponse(codes(3), 500)));

    const result = await expandValueSet(request(), accessToken, "http://x/vs");

    expect(result).toMatchObject({ ok: true, truncated: true });
  });

  it("caps an expansion the server did not page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(valueSetResponse(codes(EXPANSION_COUNT + 5))));

    const result = await expandValueSet(request(), accessToken, "http://x/vs");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.choices).toHaveLength(EXPANSION_COUNT);
      expect(result.truncated).toBe(true);
    }
  });

  it("fails on an empty expansion, which is how an unknown canonical comes back", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(valueSetResponse([])));

    expect(await expandValueSet(request(), accessToken, "http://x/missing")).toEqual({ ok: false });
  });

  it("fails on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ resourceType: "OperationOutcome" }), { status: 404 }),
    ));

    expect(await expandValueSet(request(), accessToken, "http://x/vs")).toEqual({ ok: false });
  });

  it("fails when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    expect(await expandValueSet(request(), accessToken, "http://x/vs")).toEqual({ ok: false });
  });
});

describe("expandValueSets", () => {
  beforeEach(() => {
    vi.stubEnv("IGNIS_WEB_FHIR_BASE_URL", "https://api.example/fhir/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keys each result by the canonical as given", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: URL) =>
      Promise.resolve(
        url.searchParams.get("url") === "http://x/a"
          ? valueSetResponse([{ code: "a" }])
          : new Response(null, { status: 404 }),
      ),
    ));

    const results = await expandValueSets(request(), accessToken, ["http://x/a|2", "http://x/b"]);

    expect(Object.keys(results)).toEqual(["http://x/a|2", "http://x/b"]);
    expect(results["http://x/a|2"]).toMatchObject({ ok: true });
    expect(results["http://x/b"]).toEqual({ ok: false });
  });
});
