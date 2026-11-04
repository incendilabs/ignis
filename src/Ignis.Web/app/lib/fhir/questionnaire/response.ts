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
  id?: string;
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

/** A json formatted key for the path, e.g. `[["med",1],["dose",0]]`. */
export function pathToKey(path: ResponsePath): string {
  return JSON.stringify(path.map((segment) => [segment.linkId, segment.index]));
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

/** Only a repeating group has several instances; a repeating question has several answers instead (sdcqr-2). */
export function isRepeatingGroup(item: QuestionnaireItem): boolean {
  return item.type === "group" && item.repeats === true;
}

/** One path per instance of a repeating group under `parentPath`, and one for any other item. */
export function getInstancePaths(
  response: QuestionnaireResponse,
  parentPath: ResponsePath,
  item: QuestionnaireItem,
): ResponsePath[] {
  if (isRepeatingGroup(item)) return findInstancePaths(response, parentPath, item.linkId);
  return [[...parentPath, { linkId: item.linkId, index: 0 }]];
}

/** One path per item with `linkId` directly under `parentPath`, as the response has them; none when absent. */
export function findInstancePaths(
  response: QuestionnaireResponse,
  parentPath: ResponsePath,
  linkId: string,
): ResponsePath[] {
  const count = countInstances(response, parentPath, linkId);
  return Array.from({ length: count }, (_, index) => [...parentPath, { linkId, index }]);
}

/** How many instances of `linkId` sit directly under `parentPath`; the root when it is empty. */
function countInstances(response: QuestionnaireResponse, parentPath: ResponsePath, linkId: string): number {
  return childrenAt(response, parentPath).filter((item) => item.linkId === linkId).length;
}

/** Adds an empty instance of a repeating group after its last instance under `parentPath`. */
export function addItem(
  response: QuestionnaireResponse,
  parentPath: ResponsePath,
  item: QuestionnaireItem,
): QuestionnaireResponse {
  const instance = skeleton([item]).at(0);
  if (!isRepeatingGroup(item) || instance === undefined) return response;
  const insertAfterLast = (siblings: QuestionnaireResponseItem[]) => {
    const last = indexOfLastInstance(siblings, item.linkId);
    const position = last < 0 ? siblings.length : last + 1;
    return [...siblings.slice(0, position), instance, ...siblings.slice(position)];
  };
  if (parentPath.length === 0) return { ...response, item: insertAfterLast(response.item ?? []) };
  if (response.item === undefined) return response;
  const items = updateAt(response.item, parentPath, (parent) => {
    const lists = childListsOf(parent);
    let target = (parent.answer?.length ?? 0) > 0 ? 1 : 0;
    for (const [index, list] of lists.entries()) {
      if (list.some((sibling) => sibling.linkId === item.linkId)) target = index;
    }
    return replaceChildLists(parent, lists.map((list, index) => (index === target ? insertAfterLast(list) : list)));
  });
  return items === response.item ? response : { ...response, item: items };
}

/** Removes the item at `path`, children included. */
export function removeItem(response: QuestionnaireResponse, path: ResponsePath): QuestionnaireResponse {
  if (response.item === undefined) return response;
  const items = updateAt(response.item, path, () => undefined);
  return items === response.item ? response : { ...response, item: items };
}

/** Applies `fn` to the item at `path`, and removes it when `fn` gives `undefined`; the same array when nothing changed. */
function updateAt(
  items: QuestionnaireResponseItem[],
  path: ResponsePath,
  fn: (item: QuestionnaireResponseItem) => QuestionnaireResponseItem | undefined,
): QuestionnaireResponseItem[] {
  const segment = path.at(0);
  if (segment === undefined) return items;
  const position = indexOfSegment(items, segment);
  if (position < 0) return items;
  const item = items[position];
  const rest = path.slice(1);
  const updated = rest.length === 0 ? fn(item) : updateChildAt(item, rest, fn);
  if (updated === item) return items;
  return [...items.slice(0, position), ...(updated === undefined ? [] : [updated]), ...items.slice(position + 1)];
}

/** `updateAt` in the child list of `item` that holds the first segment of `path`. */
function updateChildAt(
  item: QuestionnaireResponseItem,
  path: ResponsePath,
  fn: (item: QuestionnaireResponseItem) => QuestionnaireResponseItem | undefined,
): QuestionnaireResponseItem {
  const segment = path.at(0);
  if (segment === undefined) return item;
  const lists = childListsOf(item);
  let before = 0;
  for (const [index, list] of lists.entries()) {
    const count = list.filter((child) => child.linkId === segment.linkId).length;
    if (segment.index < before + count) {
      const local = [{ linkId: segment.linkId, index: segment.index - before }, ...path.slice(1)];
      const updated = updateAt(list, local, fn);
      return updated === list ? item : replaceChildLists(item, lists.map((other, at) => (at === index ? updated : other)));
    }
    before += count;
  }
  return item;
}

/** The child lists of an item: its own, then one per answer. qrs-1 allows only one of the two kinds. */
function childListsOf(item: QuestionnaireResponseItem): QuestionnaireResponseItem[][] {
  return [item.item ?? [], ...(item.answer ?? []).map((answer) => answer.item ?? [])];
}

/** The item with its child lists replaced, in the order `childListsOf` gives them. */
function replaceChildLists(item: QuestionnaireResponseItem, lists: QuestionnaireResponseItem[][]): QuestionnaireResponseItem {
  const result: QuestionnaireResponseItem = omit(item, "item");
  const own = lists.at(0) ?? [];
  if (own.length > 0) result.item = own;
  if (item.answer !== undefined) {
    result.answer = item.answer.map((answer, index) => {
      const kept: QuestionnaireResponseAnswer = omit(answer, "item");
      const nested = lists.at(index + 1) ?? [];
      if (nested.length > 0) kept.item = nested;
      return kept;
    });
  }
  return result;
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
    const position = indexOfSegment(siblings, segment);
    if (position < 0) return undefined;
    found = siblings[position];
    siblings = childrenOf(found);
  }
  return found;
}

/** Where the `index`-th item with `linkId` sits in `items`, or -1. */
function indexOfSegment(items: QuestionnaireResponseItem[], segment: PathSegment): number {
  let seen = 0;
  for (const [position, item] of items.entries()) {
    if (item.linkId !== segment.linkId) continue;
    if (seen === segment.index) return position;
    seen++;
  }
  return -1;
}

function indexOfLastInstance(items: QuestionnaireResponseItem[], linkId: string): number {
  return items.map((item) => item.linkId).lastIndexOf(linkId);
}

function childrenAt(response: QuestionnaireResponse, parentPath: ResponsePath): QuestionnaireResponseItem[] {
  if (parentPath.length === 0) return response.item ?? [];
  const parent = findItemAt(response.item ?? [], parentPath);
  return parent === undefined ? [] : childrenOf(parent);
}

function childrenOf(item: QuestionnaireResponseItem): QuestionnaireResponseItem[] {
  return childListsOf(item).flat();
}
