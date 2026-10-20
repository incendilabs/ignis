/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { isObject } from "../guards";
import type { Canonical, Coding, Resource } from "../model";
import type { Questionnaire, QuestionnaireItem } from "./model";

/** One answer; exactly one `value[x]` is set, and `item` nests the question's children. */
export interface QuestionnaireResponseAnswer {
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueInteger?: number;
  valueDate?: string;
  valueDateTime?: string;
  valueTime?: string;
  valueString?: string;
  valueUri?: string;
  valueCoding?: Coding;
  item?: QuestionnaireResponseItem[];
}

/** A response item. Groups nest children in `item`, questions in `answer[].item`, never both (qrs-1). */
export interface QuestionnaireResponseItem {
  linkId: string;
  text?: string;
  answer?: QuestionnaireResponseAnswer[];
  item?: QuestionnaireResponseItem[];
}

export type QuestionnaireResponseStatus =
  | "in-progress"
  | "completed"
  | "amended"
  | "entered-in-error"
  | "stopped";

/** FHIR QuestionnaireResponse — the fields a form filler needs. */
export interface QuestionnaireResponse extends Resource<"QuestionnaireResponse"> {
  resourceType: "QuestionnaireResponse";
  questionnaire?: Canonical;
  status: QuestionnaireResponseStatus;
  item?: QuestionnaireResponseItem[];
}

/** An empty in-progress response mirroring the item tree (minus display items). */
export function createResponse(
  questionnaire: Pick<Questionnaire, "url" | "version" | "item">,
): QuestionnaireResponse {
  const response: QuestionnaireResponse = { resourceType: "QuestionnaireResponse", status: "in-progress" };
  if (questionnaire.url !== undefined) {
    response.questionnaire = questionnaire.version === undefined
      ? questionnaire.url
      : `${questionnaire.url}|${questionnaire.version}`;
  }
  const items = skeleton(questionnaire.item ?? []);
  if (items.length > 0) response.item = items;
  return response;
}

function skeleton(items: QuestionnaireItem[]): QuestionnaireResponseItem[] {
  const result: QuestionnaireResponseItem[] = [];
  for (const item of items) {
    if (item.type === "display") continue;
    const responseItem: QuestionnaireResponseItem = { linkId: item.linkId };
    if (item.text !== undefined) responseItem.text = item.text;
    const children = skeleton(item.item ?? []);
    if (children.length > 0) responseItem.item = children;
    result.push(responseItem);
  }
  return result;
}

/** The answers with a value given to the item with `linkId`; empty when there are none. */
export function getAnswers(
  response: QuestionnaireResponse,
  linkId: string,
): QuestionnaireResponseAnswer[] {
  return (findItem(response.item ?? [], linkId)?.answer ?? []).filter(hasValue);
}

/**
 * A new response with the answer replaced; `undefined` or a valueless answer clears it. One answer
 * per item for now. Copies only the path to the item; a question's children follow the answer (qrs-1).
 */
export function setAnswer(
  response: QuestionnaireResponse,
  linkId: string,
  answer: QuestionnaireResponseAnswer | undefined,
): QuestionnaireResponse {
  if (response.item === undefined) return response;
  const value = answer !== undefined && hasValue(answer) ? answer : undefined;
  const items = replaceAnswer(response.item, linkId, value);
  return items === response.item ? response : { ...response, item: items };
}

function replaceAnswer(
  items: QuestionnaireResponseItem[],
  linkId: string,
  answer: QuestionnaireResponseAnswer | undefined,
): QuestionnaireResponseItem[] {
  return mapShared(items, (item) =>
    item.linkId === linkId
      ? withAnswer(item, answer)
      : mapChildren(item, (children) => replaceAnswer(children, linkId, answer)),
  );
}

function withAnswer(
  item: QuestionnaireResponseItem,
  answer: QuestionnaireResponseAnswer | undefined,
): QuestionnaireResponseItem {
  const children = answer?.item ?? item.item ?? item.answer?.[0]?.item;
  const updated = bare(item);
  if (answer === undefined) {
    if (children !== undefined) updated.item = children;
  } else {
    updated.answer = [children === undefined ? answer : { ...answer, item: children }];
  }
  return updated;
}

/** The item with `fn` applied to its children under `item` and under each answer; the item itself when unchanged. */
function mapChildren(
  item: QuestionnaireResponseItem,
  fn: (children: QuestionnaireResponseItem[]) => QuestionnaireResponseItem[],
): QuestionnaireResponseItem {
  const children = item.item === undefined ? undefined : fn(item.item);
  const answers = item.answer === undefined ? undefined : mapShared(item.answer, (answer) => {
    if (answer.item === undefined) return answer;
    const nested = fn(answer.item);
    return nested === answer.item ? answer : { ...answer, item: nested };
  });
  if (children === item.item && answers === item.answer) return item;
  const updated = { ...item };
  if (children !== undefined) updated.item = children;
  if (answers !== undefined) updated.answer = answers;
  return updated;
}

/** `entries.map(fn)`, but the same array when nothing changed. */
function mapShared<T>(entries: T[], fn: (entry: T) => T): T[] {
  const result = entries.map(fn);
  return result.every((entry, index) => entry === entries[index]) ? entries : result;
}

/** A new response without unanswered items. Disabled items are kept, so not yet the `completed` shape. */
export function pruneEmptyItems(response: QuestionnaireResponse): QuestionnaireResponse {
  const pruned: QuestionnaireResponse = omit(response, "item");
  const items = prune(response.item ?? []);
  if (items.length > 0) pruned.item = items;
  return pruned;
}

function prune(items: QuestionnaireResponseItem[]): QuestionnaireResponseItem[] {
  const result: QuestionnaireResponseItem[] = [];
  for (const item of items) {
    const children = prune(item.item ?? []);
    const answers = pruneAnswers(item.answer ?? []);
    if (children.length === 0 && answers.length === 0) continue;
    const kept = bare(item);
    if (children.length > 0) kept.item = children;
    if (answers.length > 0) kept.answer = answers;
    result.push(kept);
  }
  return result;
}

/** Answers with a value or with answered children, each pruned. */
function pruneAnswers(answers: QuestionnaireResponseAnswer[]): QuestionnaireResponseAnswer[] {
  const result: QuestionnaireResponseAnswer[] = [];
  for (const answer of answers) {
    const children = prune(answer.item ?? []);
    if (!hasValue(answer) && children.length === 0) continue;
    const kept: QuestionnaireResponseAnswer = omit(answer, "item");
    if (children.length > 0) kept.item = children;
    result.push(kept);
  }
  return result;
}

/** The item without its children and answers. */
function bare(item: QuestionnaireResponseItem): QuestionnaireResponseItem {
  const result: QuestionnaireResponseItem = { linkId: item.linkId };
  if (item.text !== undefined) result.text = item.text;
  return result;
}

/** A shallow copy without the optional property `key`. */
function omit<T extends object>(value: T, key: keyof T): T {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)) as T;
}

/** Whether the answer has a `value[x]`; empty and blank values do not count. */
function hasValue(answer: QuestionnaireResponseAnswer): boolean {
  return Object.entries(answer).some(([key, value]) => key.startsWith("value") && isPresent(value));
}

function isPresent(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (isObject(value)) return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
}

function findItem(
  items: QuestionnaireResponseItem[],
  linkId: string,
): QuestionnaireResponseItem | undefined {
  for (const item of items) {
    if (item.linkId === linkId) return item;
    const nested = findItem(childrenOf(item), linkId);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function childrenOf(item: QuestionnaireResponseItem): QuestionnaireResponseItem[] {
  return [...(item.item ?? []), ...(item.answer ?? []).flatMap((answer) => answer.item ?? [])];
}
