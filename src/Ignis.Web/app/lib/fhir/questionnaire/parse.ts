/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Coding, Extension, Resource } from "../model";
import { parseExtensions } from "../model";
import { isObject, asString } from "../guards";
import type {
  QuestionnaireEnableWhen,
  QuestionnaireItem,
  QuestionnaireItemAnswerOption,
} from "./model";

/**
 * Extracts a Questionnaire's `item` tree from a resource. 
 */
export function parseQuestionnaireItems(resource: Resource): QuestionnaireItem[] {
  if (resource.resourceType !== "Questionnaire") return [];
  return toItems(resource.item);
}

export function parseQuestionnaireExtensions(resource: Resource): Extension[] {
  if (resource.resourceType !== "Questionnaire") return [];
  return parseExtensions(resource.extension);
}

function toItems(value: unknown): QuestionnaireItem[] {
  if (!Array.isArray(value)) return [];
  const items: QuestionnaireItem[] = [];
  for (const entry of value) {
    const item = toItem(entry);
    if (item !== null) items.push(item);
  }
  return items;
}

function toItem(value: unknown): QuestionnaireItem | null {
  if (!isObject(value)) return null;

  const item: QuestionnaireItem = {
    linkId: asString(value.linkId) ?? "",
    type: asString(value.type) ?? "",
  };

  const text = asString(value.text);
  if (text !== undefined) item.text = text;
  const definition = asString(value.definition);
  if (definition !== undefined) item.definition = definition;
  if (typeof value.required === "boolean") item.required = value.required;
  if (typeof value.repeats === "boolean") item.repeats = value.repeats;
  if (typeof value.readOnly === "boolean") item.readOnly = value.readOnly;
  const answerValueSet = asString(value.answerValueSet);
  if (answerValueSet !== undefined) item.answerValueSet = answerValueSet;

  const answerOption = toAnswerOptions(value.answerOption);
  if (answerOption.length > 0) item.answerOption = answerOption;
  const enableWhen = toEnableWhen(value.enableWhen);
  if (enableWhen.length > 0) item.enableWhen = enableWhen;
  const nested = toItems(value.item);
  if (nested.length > 0) item.item = nested;
  const extension = parseExtensions(value.extension);
  if (extension.length > 0) item.extension = extension;

  return item;
}

function toAnswerOptions(value: unknown): QuestionnaireItemAnswerOption[] {
  if (!Array.isArray(value)) return [];
  const options: QuestionnaireItemAnswerOption[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    const option: QuestionnaireItemAnswerOption = {};
    if (isObject(entry.valueCoding)) option.valueCoding = toCoding(entry.valueCoding);
    const valueString = asString(entry.valueString);
    if (valueString !== undefined) option.valueString = valueString;
    if (typeof entry.valueInteger === "number") option.valueInteger = entry.valueInteger;
    const valueDate = asString(entry.valueDate);
    if (valueDate !== undefined) option.valueDate = valueDate;
    const valueTime = asString(entry.valueTime);
    if (valueTime !== undefined) option.valueTime = valueTime;
    if (typeof entry.valueBoolean === "boolean") option.valueBoolean = entry.valueBoolean;
    if (typeof entry.initialSelected === "boolean") {
      option.initialSelected = entry.initialSelected;
    }
    const extension = parseExtensions(entry.extension);
    if (extension.length > 0) option.extension = extension;
    if (hasAnswerValue(option)) options.push(option);
  }
  return options;
}

/** Whether an answer option carries a value[x] — options without one are dropped. */
function hasAnswerValue(option: QuestionnaireItemAnswerOption): boolean {
  return (
    option.valueCoding !== undefined ||
    option.valueString !== undefined ||
    option.valueInteger !== undefined ||
    option.valueDate !== undefined ||
    option.valueTime !== undefined ||
    option.valueBoolean !== undefined
  );
}

function toEnableWhen(value: unknown): QuestionnaireEnableWhen[] {
  if (!Array.isArray(value)) return [];
  const rules: QuestionnaireEnableWhen[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    const question = asString(entry.question);
    const operator = asString(entry.operator);
    if (question === undefined || operator === undefined) continue;
    rules.push({ ...entry, question, operator });
  }
  return rules;
}

function toCoding(value: Record<string, unknown>): Coding {
  const coding: Coding = {};
  const system = asString(value.system);
  if (system !== undefined) coding.system = system;
  const code = asString(value.code);
  if (code !== undefined) coding.code = code;
  const display = asString(value.display);
  if (display !== undefined) coding.display = display;
  return coding;
}
