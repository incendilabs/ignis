/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Resource } from "../model";
import { isObject, asString } from "../guards";
import type { QuestionnaireItem, QuestionnaireItemAnswerOption } from "./model";

/** A single selectable answer, flattened for display and (later) form input. */
export interface AnswerChoice {
  code?: string;
  display?: string;
  system?: string;
  label: string;
}

/**
 * The answer choices for a `choice` / `open-choice` item.
 * TODO: resolve external ValueSet (needs the server's `$expand`)
 */
export function resolveAnswerChoices(
  resource: Resource,
  item: QuestionnaireItem,
): AnswerChoice[] | null {
  if (item.type !== "choice" && item.type !== "open-choice") return null;
  if (item.answerOption && item.answerOption.length > 0) {
    return item.answerOption.map(optionToChoice);
  }
  const valueSet = item.answerValueSet;
  if (valueSet?.startsWith("#")) {
    return containedValueSetChoices(resource, valueSet.slice(1));
  }
  return null;
}

function optionToChoice(option: QuestionnaireItemAnswerOption): AnswerChoice {
  if (option.valueCoding) {
    const { code, display, system } = option.valueCoding;
    return { code, display, system, label: display ?? code ?? "" };
  }
  const scalar =
    option.valueString ??
    option.valueInteger?.toString() ??
    option.valueDate ??
    option.valueTime ??
    option.valueBoolean?.toString();
  return { display: scalar, label: scalar ?? "" };
}

function containedValueSetChoices(resource: Resource, id: string): AnswerChoice[] | null {
  const raw = (resource as { contained?: unknown; }).contained;
  const contained: unknown[] = Array.isArray(raw) ? raw : [];
  const valueSet = contained.find(
    (entry) => isObject(entry) && entry.resourceType === "ValueSet" && entry.id === id,
  );
  if (!isObject(valueSet)) return null;

  // Prefer a precomputed expansion; fall back to the compose definition.
  const choices: AnswerChoice[] = [];
  collectExpansion(choices, valueSet.expansion);
  if (choices.length === 0) collectCompose(choices, valueSet.compose);
  return choices.length > 0 ? choices : null;
}

function collectExpansion(choices: AnswerChoice[], expansion: unknown): void {
  if (!isObject(expansion) || !Array.isArray(expansion.contains)) return;
  for (const entry of expansion.contains) {
    if (isObject(entry)) choices.push(conceptToChoice(entry, asString(entry.system)));
  }
}

function collectCompose(choices: AnswerChoice[], compose: unknown): void {
  if (!isObject(compose) || !Array.isArray(compose.include)) return;
  for (const include of compose.include) {
    if (!isObject(include) || !Array.isArray(include.concept)) continue;
    const system = asString(include.system);
    for (const concept of include.concept) {
      if (isObject(concept)) choices.push(conceptToChoice(concept, system));
    }
  }
}

function conceptToChoice(concept: Record<string, unknown>, system: string | undefined): AnswerChoice {
  const code = asString(concept.code);
  const display = asString(concept.display);
  return { code, display, system, label: display ?? code ?? "" };
}
