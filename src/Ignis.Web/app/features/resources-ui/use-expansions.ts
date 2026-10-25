/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { useEffect, useMemo, useRef } from "react";
import { useFetcher } from "react-router";

import {
  type AnswerChoice,
  getExternalAnswerValueSets,
  type QuestionnaireItem,
} from "#app/lib/fhir/questionnaire";

import type { ExpansionResult } from "./expand.server";

export type ExpansionState =
  | { kind: "pending"; }
  | { kind: "error"; }
  | { kind: "ready"; choices: AnswerChoice[]; truncated: boolean; };

interface ExpansionsData {
  expansions: Record<string, ExpansionResult>;
}

/**
 * Expands the items' external ValueSets through the data-only expansions route.
 */
export function useExpansions(items: QuestionnaireItem[]): Record<string, ExpansionState> {
  const canonicals = useMemo(() => getExternalAnswerValueSets(items), [items]);
  const fetcher = useFetcher<ExpansionsData>();
  const { load, data } = fetcher;

  const requested = useRef<string | null>(null);
  useEffect(() => {
    const key = canonicals.join("\n");
    if (canonicals.length === 0 || requested.current === key) return;
    requested.current = key;
    const query = new URLSearchParams(canonicals.map((canonical) => ["url", canonical]));
    void load(`/resources/expansions?${query.toString()}`);
  }, [canonicals, load]);

  return useMemo(() => {
    const states: Record<string, ExpansionState> = {};
    for (const canonical of canonicals) {
      const result = data?.expansions[canonical];
      states[canonical] = data === undefined
        ? { kind: "pending" }
        : result?.ok
          ? { kind: "ready", choices: result.choices, truncated: result.truncated }
          : { kind: "error" };
    }
    return states;
  }, [canonicals, data]);
}
