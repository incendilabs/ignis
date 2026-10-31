/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { assertNever } from "../../assert";
import type { Coding } from "../model";
import { isObject } from "../guards";
import type { Questionnaire, QuestionnaireEnableWhen, QuestionnaireItem } from "./model";
import { getAnswers, type QuestionnaireResponse, type QuestionnaireResponseAnswer } from "./response";

/**
 * The linkIds of the enabled items. A disabled item disables its children and counts as unanswered; a rule
 * that cannot be evaluated enables. `enableBehavior` defaults to `any`. Keyed by linkId.
 */
export function getEnabledItems(
  questionnaire: Pick<Questionnaire, "item">,
  response: QuestionnaireResponse,
): Set<string> {
  const nodes = new Map<string, Node>();
  const index = (items: QuestionnaireItem[], parent: Node | undefined) => {
    for (const item of items) {
      const node = { item, parent };
      if (!nodes.has(item.linkId)) nodes.set(item.linkId, node);
      index(item.item ?? [], node);
    }
  };
  index(questionnaire.item ?? [], undefined);

  const memo = new Map<string, boolean | "visiting">();
  const isItemEnabled = (node: Node): boolean => {
    const known = memo.get(node.item.linkId);
    if (known === "visiting") return true;
    if (known !== undefined) return known;
    memo.set(node.item.linkId, "visiting");
    const result = (node.parent === undefined || isItemEnabled(node.parent)) && evaluateRules(node.item) !== false;
    memo.set(node.item.linkId, result);
    return result;
  };
  const evaluateRules = (item: QuestionnaireItem): Outcome => {
    const rules = item.enableWhen ?? [];
    if (rules.length === 0) return true;
    const outcomes = rules.map((rule) => {
      const question = nodes.get(rule.question);
      if (question === undefined) return "indeterminate";
      return evaluateRule(rule, isItemEnabled(question) ? getAnswers(response, rule.question) : []);
    });
    return combine(outcomes, item.enableBehavior);
  };

  const enabled = new Set<string>();
  for (const node of nodes.values()) {
    if (isItemEnabled(node)) enabled.add(node.item.linkId);
  }
  return enabled;
}

interface Node {
  item: QuestionnaireItem;
  parent: Node | undefined;
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
