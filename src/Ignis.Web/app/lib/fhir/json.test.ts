/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it, vi } from "vitest";

import { parseJson } from "./json";

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/fhir+json" },
  });
}

describe("parseJson", () => {
  it("parses a JSON body", async () => {
    await expect(parseJson(jsonResponse('{"total":6}'))).resolves
      .toEqual({ total: 6 });
  });

  it("returns null for a 204 response", async () => {
    const response = new Response(null, { status: 204 });
    await expect(parseJson(response)).resolves.toBeNull();
  });

  it("returns null for a non-JSON content type", async () => {
    const response = new Response("hello", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
    await expect(parseJson(response)).resolves.toBeNull();
  });

  it("returns null for an empty body", async () => {
    await expect(parseJson(jsonResponse(""))).resolves.toBeNull();
  });

  it("returns null and reports the failure when JSON is malformed", async () => {
    const onParseError = vi.fn();
    const result = await parseJson(jsonResponse("{not json", 502), { onParseError });

    expect(result).toBeNull();
    expect(onParseError).toHaveBeenCalledOnce();
    expect(onParseError.mock.calls[0][0]).toMatchObject({
      status: 502,
      contentType: "application/fhir+json",
      bodyPreview: "{not json",
    });
  });

  it("does not throw when no error handler is supplied", async () => {
    await expect(parseJson(jsonResponse("{not json"))).resolves.toBeNull();
  });
});
