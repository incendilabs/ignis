/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Extension, Resource } from "../model";
import { isObject, asString } from "../guards";
import type { QuestionnaireItem, QuestionnaireItemAnswerOption } from "./model";

/** A single selectable answer, flattened for display and (later) form input. */
export interface AnswerChoice {
  code?: string;
  display?: string;
  system?: string;
  label: string;
  extension?: Extension[];
}

/**
 * The answer choices for a `choice` / `open-choice` item, from inline `answerOption` or a
 * contained ValueSet. Null for an external `answerValueSet`: those need the server's `$expand`,
 * see {@link externalAnswerValueSets}.
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

/** Whether an item's answers come from a ValueSet that is not contained in the Questionnaire. */
export function hasExternalAnswerValueSet(item: QuestionnaireItem): boolean {
  if (item.type !== "choice" && item.type !== "open-choice") return false;
  if (item.answerOption && item.answerOption.length > 0) return false;
  return item.answerValueSet !== undefined && !item.answerValueSet.startsWith("#");
}

/** The distinct external `answerValueSet` canonicals across an item tree, in document order. */
export function externalAnswerValueSets(items: QuestionnaireItem[]): string[] {
  const canonicals = new Set<string>();
  const visit = (item: QuestionnaireItem) => {
    if (hasExternalAnswerValueSet(item) && item.answerValueSet !== undefined) {
      canonicals.add(item.answerValueSet);
    }
    item.item?.forEach(visit);
  };
  items.forEach(visit);
  return [...canonicals];
}

/** The choices of a ValueSet: its expansion when present, else the concepts listed in compose. */
export function valueSetChoices(valueSet: Record<string, unknown>): AnswerChoice[] {
  const choices: AnswerChoice[] = [];
  collectExpansion(choices, valueSet.expansion);
  if (choices.length === 0) collectCompose(choices, valueSet.compose);
  return choices;
}

function optionToChoice(option: QuestionnaireItemAnswerOption): AnswerChoice {
  let choice: AnswerChoice;
  if (option.valueCoding) {
    const { code, display, system } = option.valueCoding;
    choice = { code, display, system, label: display ?? code ?? "" };
  } else {
    const scalar =
      option.valueString ??
      option.valueInteger?.toString() ??
      option.valueDate ??
      option.valueTime ??
      option.valueBoolean?.toString();
    choice = { display: scalar, label: scalar ?? "" };
  }
  if (option.extension) choice.extension = option.extension;
  return choice;
}

function containedValueSetChoices(resource: Resource, id: string): AnswerChoice[] | null {
  const raw = (resource as { contained?: unknown; }).contained;
  const contained: unknown[] = Array.isArray(raw) ? raw : [];
  const valueSet = contained.find(
    (entry) => isObject(entry) && entry.resourceType === "ValueSet" && entry.id === id,
  );
  if (!isObject(valueSet)) return null;

  const choices = valueSetChoices(valueSet);
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
