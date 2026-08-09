/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

const VALUE_ATTRIBUTES: Record<string, string | undefined> = {
  type: "type",
  integrity: "integrity",
  crossorigin: "crossOrigin",
  referrerpolicy: "referrerPolicy",
};

const BOOLEAN_ATTRIBUTES: Record<string, string | undefined> = {
  defer: "defer",
  async: "async",
  nomodule: "noModule",
};

// http(s) or a relative path — every other scheme, and protocol-relative
// `//host`, is excluded.
const SAFE_SRC = /^(?:https?:\/\/|\/(?!\/)|\.{1,2}\/)/i;

export interface HeadScript {
  src: string;
  attributes: Record<string, string | true>;
}

/**
 * Reads the scripts a deployment adds to `<head>`, as JSON.
 *
 * ```json
 * [{ "src": "https://analytics.example.com/script.js", "defer": true,
 *    "data-website-id": "…" }]
 * ```
 *
 * Only `data-*` and the attributes below survive.
 *
 * @throws on invalid JSON.
 */
export function parseHeadScripts(spec: string): HeadScript[] {
  if (spec.trim() === "") return [];

  const parsed: unknown = JSON.parse(spec);
  if (!Array.isArray(parsed)) return [];

  const scripts: HeadScript[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;

    const fields = entry as Record<string, unknown>;
    const src = typeof fields.src === "string" ? fields.src.trim() : "";
    if (src === "" || !SAFE_SRC.test(src)) continue;

    const attributes: Record<string, string | true> = {};
    for (const [name, value] of Object.entries(fields)) {
      if (name === "src") continue;

      const booleanProp = BOOLEAN_ATTRIBUTES[name];
      if (booleanProp !== undefined) {
        if (value === true) attributes[booleanProp] = true;
        continue;
      }

      const valueProp = VALUE_ATTRIBUTES[name] ?? (name.startsWith("data-") ? name : undefined);
      if (valueProp !== undefined && typeof value === "string" && value.trim() !== "") {
        attributes[valueProp] = value.trim();
      }
    }

    scripts.push({ src, attributes });
  }

  return scripts;
}
