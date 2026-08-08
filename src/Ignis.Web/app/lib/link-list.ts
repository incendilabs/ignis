/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { isExternalHref, isSafeHref } from "#app/lib/href";

export interface ConfiguredLink {
  label: string;
  href: string;
  external: boolean;
}

/**
 * Reads a list of links a deployment configures, as JSON.
 *
 * ```json
 * [
 *   { "href": "/pages/terms", "label": { "en": "Terms of use", "nb": "Vilkår" } },
 *   { "href": { "en": "https://example.com/status", "nb": "https://example.no/status" },
 *     "label": "Status" }
 * ]
 * ```
 *
 * `href` and `label` each take a plain string or an object keyed by locale,
 * falling back to `baseLocale`. Unusable entries are skipped — no href or
 * label, or a scheme `isSafeHref` rejects — rather than failing a boot.
 *
 * @throws on invalid JSON; an empty footer would look like a missing setting.
 */
export function parseLinkList(spec: string, locale: string, baseLocale: string): ConfiguredLink[] {
  if (spec.trim() === "") return [];

  const parsed: unknown = JSON.parse(spec);
  if (!Array.isArray(parsed)) return [];

  const links: ConfiguredLink[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;

    const { href, label } = entry as { href?: unknown; label?: unknown; };
    const resolvedHref = pickLocalized(href, locale, baseLocale);
    const resolvedLabel = pickLocalized(label, locale, baseLocale);
    if (resolvedHref === null || resolvedLabel === null) continue;
    if (!isSafeHref(resolvedHref)) continue;

    links.push({
      label: resolvedLabel,
      href: resolvedHref,
      external: isExternalHref(resolvedHref),
    });
  }

  return links;
}

/** A plain string, or the entry for this locale in an object keyed by locale. */
function pickLocalized(value: unknown, locale: string, baseLocale: string): string | null {
  const plain = asNonEmptyString(value);
  if (plain !== null) return plain;

  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const byLocale = value as Record<string, unknown>;
  return asNonEmptyString(byLocale[locale]) ?? asNonEmptyString(byLocale[baseLocale]);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
