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

/** The `index`-th sibling with `linkId`. */
export interface PathSegment {
  linkId: string;
  index: number;
}

/** Segments from the root down to a response item. */
export type ResponsePath = readonly PathSegment[];

/** A key for the path, e.g. `meds[1]/dose[0]`. */
export function pathToKey(path: ResponsePath): string {
  return path.map((segment) => `${segment.linkId}[${String(segment.index)}]`).join("/");
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

/** Answers with a value, across every instance of `linkId`. */
export function getAnswers(
  response: QuestionnaireResponse,
  linkId: string,
): QuestionnaireResponseAnswer[] {
  return findItems(response.item ?? [], linkId).flatMap((item) => item.answer ?? []).filter(hasValue);
}

/** Answers with a value at `path`. */
export function getAnswersAt(
  response: QuestionnaireResponse,
  path: ResponsePath,
): QuestionnaireResponseAnswer[] {
  return (findItemAt(response.item ?? [], path)?.answer ?? []).filter(hasValue);
}

/** Replaces the answer at `path`; a valueless answer clears it. One answer per item for now. */
export function setAnswer(
  response: QuestionnaireResponse,
  path: ResponsePath,
  answer: QuestionnaireResponseAnswer | undefined,
): QuestionnaireResponse {
  if (response.item === undefined) return response;
  const value = answer !== undefined && hasValue(answer) ? answer : undefined;
  const items = updateAt(response.item, path, (item) => replaceAnswer(item, value));
  return items === response.item ? response : { ...response, item: items };
}

/** Children move under the answer, and back under the item when cleared (qrs-1). */
function replaceAnswer(
  item: QuestionnaireResponseItem,
  answer: QuestionnaireResponseAnswer | undefined,
): QuestionnaireResponseItem {
  const children = answer?.item ?? childrenOf(item);
  const updated = bare(item);
  if (answer === undefined) {
    if (children.length > 0) updated.item = children;
  } else {
    updated.answer = [children.length === 0 ? answer : { ...answer, item: children }];
  }
  return updated;
}

/** Children stay where they were: under the item, else under the first answer. */
function replaceChildren(
  item: QuestionnaireResponseItem,
  children: QuestionnaireResponseItem[],
): QuestionnaireResponseItem {
  const first = item.answer?.at(0);
  const rest = item.answer?.slice(1) ?? [];
  if (first !== undefined && item.item === undefined) {
    const head: QuestionnaireResponseAnswer = omit(first, "item");
    if (children.length > 0) head.item = children;
    return { ...item, answer: [head, ...rest.map((answer) => omit(answer, "item"))] };
  }
  const updated: QuestionnaireResponseItem = omit(item, "item");
  if (children.length > 0) updated.item = children;
  return updated;
}

/** Applies `fn` to the item at `path`; the same array when nothing changed. */
function updateAt(
  items: QuestionnaireResponseItem[],
  path: ResponsePath,
  fn: (item: QuestionnaireResponseItem) => QuestionnaireResponseItem,
): QuestionnaireResponseItem[] {
  const segment = path.at(0);
  const rest = path.slice(1);
  if (segment === undefined) return items;
  const result: QuestionnaireResponseItem[] = [];
  let seen = 0;
  let changed = false;
  for (const item of items) {
    if (item.linkId !== segment.linkId || seen++ !== segment.index) {
      result.push(item);
      continue;
    }
    const updated = rest.length === 0 ? fn(item) : updateChildren(item, (children) => updateAt(children, rest, fn));
    if (updated !== item) changed = true;
    result.push(updated);
  }
  return changed ? result : items;
}

function updateChildren(
  item: QuestionnaireResponseItem,
  fn: (children: QuestionnaireResponseItem[]) => QuestionnaireResponseItem[],
): QuestionnaireResponseItem {
  const children = childrenOf(item);
  const updated = fn(children);
  return updated === children ? item : replaceChildren(item, updated);
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

/** All items with `linkId`, at any depth. */
function findItems(items: QuestionnaireResponseItem[], linkId: string): QuestionnaireResponseItem[] {
  return items.flatMap((item) =>
    item.linkId === linkId ? [item, ...findItems(childrenOf(item), linkId)] : findItems(childrenOf(item), linkId),
  );
}

function findItemAt(items: QuestionnaireResponseItem[], path: ResponsePath): QuestionnaireResponseItem | undefined {
  let siblings = items;
  let found: QuestionnaireResponseItem | undefined;
  for (const segment of path) {
    found = siblings.filter((item) => item.linkId === segment.linkId).at(segment.index);
    if (found === undefined) return undefined;
    siblings = childrenOf(found);
  }
  return found;
}

function childrenOf(item: QuestionnaireResponseItem): QuestionnaireResponseItem[] {
  return [...(item.item ?? []), ...(item.answer ?? []).flatMap((answer) => answer.item ?? [])];
}
