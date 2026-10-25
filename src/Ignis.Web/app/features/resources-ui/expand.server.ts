/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { fhirHeaders, resolveFhirUrl } from "#app/fhir.server";
import { mapWithConcurrency } from "#app/lib/concurrency";
import { isObject } from "#app/lib/fhir/guards";
import { type AnswerChoice, valueSetToAnswerChoices } from "#app/lib/fhir/questionnaire";
import { Logger } from "#app/logger";

const logger = Logger.create({ namespace: "resources-ui:expand" });

/** Codes per expansion. Enough for a pick list; keeps a SNOMED-sized ValueSet off the page. */
export const EXPANSION_COUNT = 100;
const EXPAND_CONCURRENCY = 4;

export type ExpansionResult =
  | { ok: true; choices: AnswerChoice[]; truncated: boolean; }
  | { ok: false; };

/**
 * Expands a ValueSet by canonical (`url` or `url|version`) through the server's `$expand`,
 * flattened to answer choices. `ok: false` covers every failure — unreachable, unresolvable
 * canonical, non-ValueSet body — since the UI shows the same hint for all of them.
 */
export async function expandValueSet(
  request: Request,
  accessToken: string | undefined,
  canonical: string,
): Promise<ExpansionResult> {
  const separator = canonical.indexOf("|");
  const url = separator === -1 ? canonical : canonical.slice(0, separator);
  const version = separator === -1 ? "" : canonical.slice(separator + 1);

  let response: Response;
  try {
    const target = resolveFhirUrl(request, "ValueSet/$expand");
    target.searchParams.set("url", url);
    if (version !== "") target.searchParams.set("valueSetVersion", version);
    target.searchParams.set("count", String(EXPANSION_COUNT));
    response = await fetch(target, { headers: fhirHeaders(accessToken) });
  } catch (error) {
    logger.warn({ error, context: { canonical } }, "Failed to call $expand");
    return { ok: false };
  }

  if (!response.ok) {
    logger.warn({ context: { canonical, status: response.status } }, "$expand failed");
    return { ok: false };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false };
  }
  if (!isObject(payload) || payload.resourceType !== "ValueSet") return { ok: false };

  // An unknown canonical comes back as an empty expansion rather than a 404, so
  // nothing-to-show is reported the same way as any other failure.
  const all = valueSetToAnswerChoices(payload);
  if (all.length === 0) {
    logger.warn({ context: { canonical } }, "$expand returned no codes");
    return { ok: false };
  }

  // The server may ignore `count`, so cap here too; `expansion.total` tells when it did not.
  const total = isObject(payload.expansion) && typeof payload.expansion.total === "number"
    ? payload.expansion.total
    : undefined;
  const choices = all.slice(0, EXPANSION_COUNT);
  const truncated = all.length > choices.length || (total !== undefined && total > choices.length);
  return { ok: true, choices, truncated };
}

/** Expands several canonicals, a few at a time, keyed by the canonical as given. */
export async function expandValueSets(
  request: Request,
  accessToken: string | undefined,
  canonicals: string[],
): Promise<Record<string, ExpansionResult>> {
  const results = await mapWithConcurrency(canonicals, EXPAND_CONCURRENCY, (canonical) =>
    expandValueSet(request, accessToken, canonical),
  );
  return Object.fromEntries(canonicals.map((canonical, index) => [canonical, results[index]]));
}
