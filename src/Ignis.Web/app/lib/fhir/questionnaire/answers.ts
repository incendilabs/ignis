/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Coding, Extension, Resource } from "../model";
import { isObject, asString } from "../guards";
import type { QuestionnaireItem, QuestionnaireItemAnswerOption } from "./model";
import type { QuestionnaireResponseAnswer } from "./response";

/** A selectable answer: the answer it gives and how to label it. */
export interface AnswerChoice {
  label: string;
  answer: QuestionnaireResponseAnswer;
  extension?: Extension[];
}

/**
 * The answer choices for a `choice` / `open-choice` item, from inline `answerOption` or a
 * contained ValueSet. Null for an external `answerValueSet`: those need the server's `$expand`,
 * see {@link getExternalAnswerValueSets}.
 */
export function resolveAnswerChoices(
  resource: Resource,
  item: QuestionnaireItem,
): AnswerChoice[] | null {
  if (item.type !== "choice" && item.type !== "open-choice") return null;
  if (item.answerOption && item.answerOption.length > 0) {
    return item.answerOption.flatMap((option) => optionToAnswerChoice(option) ?? []);
  }
  const valueSet = item.answerValueSet;
  if (valueSet?.startsWith("#")) {
    return resolveContainedAnswerChoices(resource, valueSet.slice(1));
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
export function getExternalAnswerValueSets(items: QuestionnaireItem[]): string[] {
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
export function valueSetToAnswerChoices(valueSet: Record<string, unknown>): AnswerChoice[] {
  const choices: AnswerChoice[] = [];
  collectExpansion(choices, valueSet.expansion);
  if (choices.length === 0) collectCompose(choices, valueSet.compose);
  return choices;
}

export function findAnswerChoiceIndex(
  choices: AnswerChoice[],
  answer: QuestionnaireResponseAnswer | undefined,
): number {
  if (answer === undefined) return -1;
  return choices.findIndex((choice) => isSameAnswer(choice.answer, answer));
}

/** Codings match on system and code only; other values on type and value. */
export function isSameAnswer(first: QuestionnaireResponseAnswer, second: QuestionnaireResponseAnswer): boolean {
  if (first.valueCoding !== undefined && second.valueCoding !== undefined) {
    return first.valueCoding.system === second.valueCoding.system
      && first.valueCoding.code === second.valueCoding.code;
  }
  const firstValue = getValueEntry(first);
  const secondValue = getValueEntry(second);
  if (firstValue === undefined || secondValue === undefined) return false;
  return firstValue[0] === secondValue[0] && firstValue[1] === secondValue[1];
}

function getValueEntry(answer: QuestionnaireResponseAnswer): [string, unknown] | undefined {
  return Object.entries(answer).find(([key]) => key.startsWith("value"));
}

function optionToAnswerChoice(option: QuestionnaireItemAnswerOption): AnswerChoice | undefined {
  const answer = optionToAnswer(option);
  if (answer === undefined) return undefined;
  const choice: AnswerChoice = { label: getAnswerLabel(answer), answer };
  if (option.extension) choice.extension = option.extension;
  return choice;
}

function getAnswerLabel(answer: QuestionnaireResponseAnswer): string {
  if (answer.valueCoding !== undefined) return answer.valueCoding.display ?? answer.valueCoding.code ?? "";
  return answer.valueString
    ?? answer.valueInteger?.toString()
    ?? answer.valueDate
    ?? answer.valueTime
    ?? answer.valueBoolean?.toString()
    ?? "";
}

function optionToAnswer(option: QuestionnaireItemAnswerOption): QuestionnaireResponseAnswer | undefined {
  if (option.valueCoding !== undefined) return { valueCoding: option.valueCoding };
  if (option.valueString !== undefined) return { valueString: option.valueString };
  if (option.valueInteger !== undefined) return { valueInteger: option.valueInteger };
  if (option.valueDate !== undefined) return { valueDate: option.valueDate };
  if (option.valueTime !== undefined) return { valueTime: option.valueTime };
  if (option.valueBoolean !== undefined) return { valueBoolean: option.valueBoolean };
  return undefined;
}

function resolveContainedAnswerChoices(resource: Resource, id: string): AnswerChoice[] | null {
  const raw = (resource as { contained?: unknown; }).contained;
  const contained: unknown[] = Array.isArray(raw) ? raw : [];
  const valueSet = contained.find(
    (entry) => isObject(entry) && entry.resourceType === "ValueSet" && entry.id === id,
  );
  if (!isObject(valueSet)) return null;

  const choices = valueSetToAnswerChoices(valueSet);
  return choices.length > 0 ? choices : null;
}

function collectExpansion(choices: AnswerChoice[], expansion: unknown): void {
  if (!isObject(expansion) || !Array.isArray(expansion.contains)) return;
  for (const entry of expansion.contains) {
    if (isObject(entry)) choices.push(conceptToAnswerChoice(entry, asString(entry.system)));
  }
}

function collectCompose(choices: AnswerChoice[], compose: unknown): void {
  if (!isObject(compose) || !Array.isArray(compose.include)) return;
  for (const include of compose.include) {
    if (!isObject(include) || !Array.isArray(include.concept)) continue;
    const system = asString(include.system);
    for (const concept of include.concept) {
      if (isObject(concept)) choices.push(conceptToAnswerChoice(concept, system));
    }
  }
}

function conceptToAnswerChoice(concept: Record<string, unknown>, system: string | undefined): AnswerChoice {
  const code = asString(concept.code);
  const display = asString(concept.display);
  const coding: Coding = {};
  if (system !== undefined) coding.system = system;
  if (code !== undefined) coding.code = code;
  if (display !== undefined) coding.display = display;
  return { label: display ?? code ?? "", answer: { valueCoding: coding } };
}
