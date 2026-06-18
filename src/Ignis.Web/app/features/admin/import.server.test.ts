/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpStatus } from "#app/lib/fhir/http";

import { getArchiveImportMaxUploadBytes, runArchiveImport } from "./import.server";
import { archiveImportFileField, archiveImportMaxUploadBytesFallback } from "./import.shared";

const accessToken = "test-token";

function archiveFile() {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "archive.zip", {
    type: "application/zip",
  });
}

function request() {
  return new Request("https://web.example/admin/import");
}

function parametersResponse(parameter: { name?: string; valueInteger?: number }[]) {
  return new Response(
    JSON.stringify({ resourceType: "Parameters", parameter }),
    { status: HttpStatus.Ok, headers: { "Content-Type": "application/fhir+json" } },
  );
}

describe("runArchiveImport", () => {
  beforeEach(() => {
    vi.stubEnv("IGNIS_WEB_FHIR_BASE_URL", "https://api.example/fhir/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uploads as multipart to the import endpoint and surfaces the operation id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ resourceType: "OperationOutcome", id: "op-1" }),
        { status: HttpStatus.Accepted, headers: { "Content-Type": "application/fhir+json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runArchiveImport(request(), archiveFile(), accessToken);

    expect(result.ok).toBe(true);
    expect(result.operationId).toBe("op-1");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.lastCall as [URL, RequestInit];
    expect(url.toString()).toBe("https://api.example/fhir/$archive-import");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    // Never set Content-Type, or fetch can't add the multipart boundary.
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect((init.body as FormData).get(archiveImportFileField)).toBeInstanceOf(File);
  });
});

describe("getArchiveImportMaxUploadBytes", () => {
  beforeEach(() => {
    vi.stubEnv("IGNIS_WEB_FHIR_BASE_URL", "https://api.example/fhir/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the limit reported by the endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        parametersResponse([{ name: "maxUploadSizeBytes", valueInteger: 104857600 }]),
      ),
    );

    expect(await getArchiveImportMaxUploadBytes(request(), accessToken)).toBe(104857600);
  });

  it("falls back when the reported limit is not positive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        parametersResponse([{ name: "maxUploadSizeBytes", valueInteger: 0 }]),
      ),
    );

    expect(await getArchiveImportMaxUploadBytes(request(), accessToken)).toBe(
      archiveImportMaxUploadBytesFallback,
    );
  });
});
