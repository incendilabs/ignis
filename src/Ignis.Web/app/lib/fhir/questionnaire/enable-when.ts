/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { assertNever } from "../../assert";
import type { Coding } from "../model";
import { isObject } from "../guards";
import type { Questionnaire, QuestionnaireEnableWhen, QuestionnaireItem } from "./model";
import {
  findInstancePaths,
  getAnswersAt,
  getInstancePaths,
  pathToKey,
  type QuestionnaireResponse,
  type QuestionnaireResponseAnswer,
  type ResponsePath,
} from "./response";

/** Whether the item with `linkId` under the instance at `parentPath` is enabled. */
export type EnabledItemCheck = (parentPath: ResponsePath, linkId: string) => boolean;

/**
 * A disabled item disables its children and counts as unanswered; a rule that cannot be evaluated enables.
 * `enableBehavior` defaults to `any`. A rule reads the question instances nearest to the item, so inside a
 * repeating group each instance follows its own answers. Every item is evaluated up front in questionnaire
 * order, so circular rules resolve the same way for every caller; create the check once per response.
 */
export function createEnabledItemCheck(
  questionnaire: Pick<Questionnaire, "item">,
  response: QuestionnaireResponse,
): EnabledItemCheck {
  const nodesByLinkId = getNodesByLinkId(questionnaire.item ?? []);

  const enabledByItemKey = new Map<string, boolean>();
  const itemKeysBeingEvaluated = new Set<string>();
  const isItemEnabled = (parentPath: ResponsePath, node: Node): boolean => {
    const itemKey = getItemKey(parentPath, node.item.linkId);
    if (itemKeysBeingEvaluated.has(itemKey)) return true;
    const previouslyComputedIsEnabled = enabledByItemKey.get(itemKey);
    if (previouslyComputedIsEnabled !== undefined) return previouslyComputedIsEnabled;
    itemKeysBeingEvaluated.add(itemKey);
    const parentEnabled = node.parent === undefined || isItemEnabled(parentPath.slice(0, -1), node.parent);
    const result = parentEnabled && evaluateEnableWhen(node.item, parentPath) !== false;
    itemKeysBeingEvaluated.delete(itemKey);
    enabledByItemKey.set(itemKey, result);
    return result;
  };
  const evaluateEnableWhen = (item: QuestionnaireItem, parentPath: ResponsePath): Outcome => {
    const rules = item.enableWhen ?? [];
    if (rules.length === 0) return true;
    const outcomes = rules.map((rule) => {
      const question = nodesByLinkId.get(rule.question);
      return question === undefined
        ? "indeterminate"
        : evaluateRule(rule, getAnswersFromNearestInstances(question, parentPath));
    });
    return combine(outcomes, item.enableBehavior);
  };
  /**
   * Answers of the enabled instances of `question` below the ancestor instance it shares with `parentPath`:
   * `reason` under `meds[1]` reads `prn` under `meds[1]`, a question outside the group reads every `prn`.
   */
  const getAnswersFromNearestInstances = (question: Node, parentPath: ResponsePath): QuestionnaireResponseAnswer[] => {
    const ancestorsAndSelf = getAncestorsAndSelf(question);
    const sharedAncestors = countSharedAncestors(parentPath, ancestorsAndSelf);
    let instancePaths: ResponsePath[] = [parentPath.slice(0, sharedAncestors)];
    for (const item of ancestorsAndSelf.slice(sharedAncestors)) {
      instancePaths = instancePaths.flatMap((path) => findInstancePaths(response, path, item.linkId));
    }
    const enabledInstancePaths = instancePaths.filter((path) => {
      const questionParentPath = path.slice(0, -1);
      return isItemEnabled(questionParentPath, question);
    });
    const answers = enabledInstancePaths.flatMap((path) => getAnswersAt(response, path));
    return answers;
  };

  const evaluateInQuestionnaireOrder = (items: QuestionnaireItem[], parentPath: ResponsePath) => {
    for (const item of items) {
      const node = nodesByLinkId.get(item.linkId);
      if (node !== undefined) isItemEnabled(parentPath, node);
      for (const path of getInstancePaths(response, parentPath, item)) {
        evaluateInQuestionnaireOrder(item.item ?? [], path);
      }
    }
  };
  evaluateInQuestionnaireOrder(questionnaire.item ?? [], []);

  return (parentPath, linkId) => {
    const node = nodesByLinkId.get(linkId);
    return node !== undefined && isItemEnabled(parentPath, node);
  };
}

interface Node {
  item: QuestionnaireItem;
  parent: Node | undefined;
}

/** All instances of an item under one parent are enabled alike, so the first instance's path serves as key. */
function getItemKey(parentPath: ResponsePath, linkId: string): string {
  return pathToKey([...parentPath, { linkId, index: 0 }]);
}

/** Every item with its parent, by linkId; the first wins when a linkId repeats. */
function getNodesByLinkId(items: QuestionnaireItem[]): Map<string, Node> {
  const nodesByLinkId = new Map<string, Node>();
  const addItems = (items: QuestionnaireItem[], parent: Node | undefined) => {
    for (const item of items) {
      const node = { item, parent };
      if (!nodesByLinkId.has(item.linkId)) nodesByLinkId.set(item.linkId, node);
      addItems(item.item ?? [], node);
    }
  };
  addItems(items, undefined);
  return nodesByLinkId;
}

/** The items from the root down to and including `node`. */
function getAncestorsAndSelf(node: Node): QuestionnaireItem[] {
  const items: QuestionnaireItem[] = [];
  for (let current: Node | undefined = node; current !== undefined; current = current.parent) {
    items.unshift(current.item);
  }
  return items;
}

/** How many leading segments of `path` and leading items of `ancestorsAndSelf` have the same linkId. */
function countSharedAncestors(path: ResponsePath, ancestorsAndSelf: QuestionnaireItem[]): number {
  let shared = 0;
  while (shared < path.length && path.at(shared)?.linkId === ancestorsAndSelf.at(shared)?.linkId) shared++;
  return shared;
}

/** A rule's result; `indeterminate` when it cannot be evaluated. */
type Outcome = boolean | "indeterminate";

type OrderOperator = ">" | "<" | ">=" | "<=";

type Value =
  | { kind: "primitive"; value: string | number | boolean; }
  | { kind: "coding"; coding: Coding; };

function combine(outcomes: Outcome[], enableBehavior: string | undefined): Outcome {
  return enableBehavior === "all" ? allTrue(outcomes) : anyTrue(outcomes);
}

/** Three-valued `anyTrue`: true wins, then indeterminate. */
function anyTrue(outcomes: Outcome[]): Outcome {
  if (outcomes.includes(true)) return true;
  return outcomes.includes("indeterminate") ? "indeterminate" : false;
}

/** Three-valued `allTrue`: false wins, then indeterminate. */
function allTrue(outcomes: Outcome[]): Outcome {
  if (outcomes.includes(false)) return false;
  return outcomes.includes("indeterminate") ? "indeterminate" : true;
}

/** Whether the rule holds; `!=` holds when no answer matches, also when unanswered. */
function evaluateRule(rule: QuestionnaireEnableWhen, answers: QuestionnaireResponseAnswer[]): Outcome {
  const expected = expectedValue(rule);
  if (expected === undefined) return "indeterminate";
  const operator = rule.operator;
  if (operator === "exists") {
    return expected.kind === "primitive" && typeof expected.value === "boolean"
      ? expected.value === (answers.length > 0)
      : "indeterminate";
  }

  const values = answers.map(answerValue).filter((value) => value !== undefined);
  const unreadable = values.length < answers.length;
  const result = ((): Outcome => {
    switch (operator) {
      case "=":
        return values.some((value) => equals(value, expected));
      case "!=":
        return !values.some((value) => equals(value, expected));
      case ">":
      case "<":
      case ">=":
      case "<=":
        return anyTrue(values.map((value) => compare(value, operator, expected)));
      default:
        return "indeterminate";
    }
  })();
  return result === false && unreadable ? "indeterminate" : result;
}

/** Codings match on `code`, and on `system` when the rule has one. */
function equals(actual: Value, expected: Value): boolean {
  if (actual.kind === "coding" && expected.kind === "coding") {
    return actual.coding.code === expected.coding.code
      && (expected.coding.system === undefined || actual.coding.system === expected.coding.system);
  }
  return actual.kind === "primitive" && expected.kind === "primitive" && actual.value === expected.value;
}

/** Numbers as numbers; dates and times as ISO text, which assumes equal precision and time zone. */
function compare(actual: Value, operator: OrderOperator, expected: Value): Outcome {
  if (actual.kind !== "primitive" || expected.kind !== "primitive") return "indeterminate";
  const a = actual.value;
  const b = expected.value;
  if (typeof a === "boolean" || typeof b === "boolean" || typeof a !== typeof b) return "indeterminate";
  switch (operator) {
    case ">": return a > b;
    case "<": return a < b;
    case ">=": return a >= b;
    case "<=": return a <= b;
    default: return assertNever(operator);
  }
}

/** The rule's `answer[x]`, whichever is set; undefined for types not supported yet. */
function expectedValue(rule: QuestionnaireEnableWhen): Value | undefined {
  for (const [key, value] of Object.entries(rule)) {
    if (!key.startsWith("answer")) continue;
    if (key === "answerCoding" && isObject(value)) return { kind: "coding", coding: value };
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return { kind: "primitive", value };
    }
  }
  return undefined;
}

/** The answer's `value[x]`, whichever is set; undefined for types not supported yet. */
function answerValue(answer: QuestionnaireResponseAnswer): Value | undefined {
  if (answer.valueCoding !== undefined) return { kind: "coding", coding: answer.valueCoding };
  const primitive = answer.valueBoolean
    ?? answer.valueDecimal
    ?? answer.valueInteger
    ?? answer.valueDate
    ?? answer.valueDateTime
    ?? answer.valueTime
    ?? answer.valueString
    ?? answer.valueUri;
  return primitive === undefined ? undefined : { kind: "primitive", value: primitive };
}
