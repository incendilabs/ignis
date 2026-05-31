/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/** Diagnostic detail passed to {@link ParseJsonOptions.onParseError}. */
export interface JsonParseFailure {
  url: string;
  status: number;
  contentType: string;
  /** First 500 characters of the response body. */
  bodyPreview: string;
  error: unknown;
}

export interface ParseJsonOptions {
  /**
   * Invoked when the response claims JSON but parsing fails. Lets the caller
   * log the anomaly without the core taking a logger dependency.
   */
  onParseError?: (failure: JsonParseFailure) => void;
}

/**
 * Reads a JSON response body, returning `null` for absent content (204, an
 * empty body, or a non-JSON `Content-Type`). When the body claims JSON but
 * fails to parse, returns `null` and reports the failure via
 * {@link ParseJsonOptions.onParseError} rather than throwing.
 */
export async function parseJson(
  response: Response,
  options?: ParseJsonOptions,
): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("json")) return null;

  const text = await response.text();
  if (text.length === 0) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    options?.onParseError?.({
      url: response.url,
      status: response.status,
      contentType,
      bodyPreview: text.slice(0, 500),
      error,
    });
    return null;
  }
}
