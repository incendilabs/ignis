/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { getEnabledItems } from "./enable-when";
import type { QuestionnaireEnableWhen, QuestionnaireItem } from "./model";
import { createResponse, type QuestionnaireResponse, type QuestionnaireResponseAnswer, setAnswer } from "./response";

const questions: QuestionnaireItem[] = [
  { linkId: "smoker", type: "boolean" },
  { linkId: "packs", type: "integer" },
  { linkId: "gender", type: "choice" },
  { linkId: "since", type: "date" },
];

/** Whether an item `q` guarded by the rules is enabled, placed after the questions. */
function isEnabledWhen(
  rules: QuestionnaireEnableWhen[],
  response: QuestionnaireResponse,
  enableBehavior?: string,
): boolean {
  const q: QuestionnaireItem = { linkId: "q", type: "string", enableWhen: rules };
  if (enableBehavior !== undefined) q.enableBehavior = enableBehavior;
  return getEnabledItems({ item: [...questions, q] }, response).has("q");
}

function answered(linkId: string, answer: QuestionnaireResponseAnswer): QuestionnaireResponse {
  return setAnswer(createResponse({ item: questions }), linkId, answer);
}

const unanswered = createResponse({ item: questions });

describe("getEnabledItems", () => {
  it("enables items without rules", () => {
    expect(getEnabledItems({ item: questions }, unanswered)).toEqual(new Set(["smoker", "packs", "gender", "since"]));
  });

  it("checks exists against whether the question was answered", () => {
    const rule: QuestionnaireEnableWhen = { question: "smoker", operator: "exists", answerBoolean: true };
    expect(isEnabledWhen([rule], unanswered)).toBe(false);
    expect(isEnabledWhen([rule], answered("smoker", { valueBoolean: false }))).toBe(true);

    const absent: QuestionnaireEnableWhen = { question: "smoker", operator: "exists", answerBoolean: false };
    expect(isEnabledWhen([absent], unanswered)).toBe(true);
  });

  it("compares primitives with =, false when unanswered", () => {
    const rule: QuestionnaireEnableWhen = { question: "smoker", operator: "=", answerBoolean: true };
    expect(isEnabledWhen([rule], answered("smoker", { valueBoolean: true }))).toBe(true);
    expect(isEnabledWhen([rule], answered("smoker", { valueBoolean: false }))).toBe(false);
    expect(isEnabledWhen([rule], unanswered)).toBe(false);
  });

  it("holds != when no answer matches, so also when unanswered", () => {
    const rule: QuestionnaireEnableWhen = { question: "gender", operator: "!=", answerCoding: { code: "female" } };
    expect(isEnabledWhen([rule], answered("gender", { valueCoding: { code: "male" } }))).toBe(true);
    expect(isEnabledWhen([rule], answered("gender", { valueCoding: { code: "female" } }))).toBe(false);
    expect(isEnabledWhen([rule], unanswered)).toBe(true);

    const both: QuestionnaireResponse = {
      resourceType: "QuestionnaireResponse",
      status: "in-progress",
      item: [{ linkId: "gender", answer: [{ valueCoding: { code: "male" } }, { valueCoding: { code: "female" } }] }],
    };
    expect(isEnabledWhen([rule], both)).toBe(false);
  });

  it("matches codings on code, and on system when the rule has one", () => {
    const system = "http://hl7.org/fhir/administrative-gender";
    const strict: QuestionnaireEnableWhen = { question: "gender", operator: "=", answerCoding: { system, code: "female" } };
    expect(isEnabledWhen([strict], answered("gender", { valueCoding: { system, code: "female" } }))).toBe(true);
    expect(isEnabledWhen([strict], answered("gender", { valueCoding: { code: "female" } }))).toBe(false);
    expect(isEnabledWhen([strict], answered("gender", { valueCoding: { system: "http://other", code: "female" } }))).toBe(false);
    expect(isEnabledWhen([strict], answered("gender", { valueCoding: { system, code: "male" } }))).toBe(false);

    const loose: QuestionnaireEnableWhen = { question: "gender", operator: "=", answerCoding: { code: "female" } };
    expect(isEnabledWhen([loose], answered("gender", { valueCoding: { system, code: "female" } }))).toBe(true);
  });

  it("orders numbers as numbers and dates as text", () => {
    const packs: QuestionnaireEnableWhen = { question: "packs", operator: ">=", answerInteger: 10 };
    expect(isEnabledWhen([packs], answered("packs", { valueInteger: 10 }))).toBe(true);
    expect(isEnabledWhen([packs], answered("packs", { valueInteger: 9 }))).toBe(false);
    expect(isEnabledWhen([packs], unanswered)).toBe(false);

    const since: QuestionnaireEnableWhen = { question: "since", operator: "<", answerDate: "2020-01-01" };
    expect(isEnabledWhen([since], answered("since", { valueDate: "2019-06-30" }))).toBe(true);
    expect(isEnabledWhen([since], answered("since", { valueDate: "2021-01-01" }))).toBe(false);
  });

  it("combines rules with any by default and all when asked", () => {
    const rules: QuestionnaireEnableWhen[] = [
      { question: "smoker", operator: "=", answerBoolean: true },
      { question: "packs", operator: ">", answerInteger: 0 },
    ];
    const smokerOnly = answered("smoker", { valueBoolean: true });

    expect(isEnabledWhen(rules, smokerOnly)).toBe(true);
    expect(isEnabledWhen(rules, smokerOnly, "all")).toBe(false);
    expect(isEnabledWhen(rules, setAnswer(smokerOnly, "packs", { valueInteger: 2 }), "all")).toBe(true);
  });

  it("disables everything under a disabled item", () => {
    const questionnaire = {
      item: [
        ...questions,
        {
          linkId: "g",
          type: "group",
          enableWhen: [{ question: "smoker", operator: "=", answerBoolean: true }],
          item: [{ linkId: "q", type: "string" }],
        },
      ],
    };
    expect(getEnabledItems(questionnaire, unanswered).has("q")).toBe(false);
    expect(getEnabledItems(questionnaire, answered("smoker", { valueBoolean: true })).has("q")).toBe(true);
  });

  it("treats a disabled question as unanswered", () => {
    const questionnaire = {
      item: [
        { linkId: "smoker", type: "boolean" },
        { linkId: "packs", type: "integer", enableWhen: [{ question: "smoker", operator: "=", answerBoolean: true }] },
        { linkId: "q", type: "string", enableWhen: [{ question: "packs", operator: ">", answerInteger: 0 }] },
      ],
    };
    let response = setAnswer(createResponse(questionnaire), "smoker", { valueBoolean: true });
    response = setAnswer(response, "packs", { valueInteger: 5 });
    expect(getEnabledItems(questionnaire, response).has("q")).toBe(true);

    response = setAnswer(response, "smoker", { valueBoolean: false });
    expect(getEnabledItems(questionnaire, response)).toEqual(new Set(["smoker"]));
  });

  it("enables an item whose rule it cannot evaluate", () => {
    const packs = answered("packs", { valueInteger: 5 });
    expect(isEnabledWhen([{ question: "packs", operator: "~", answerInteger: 1 }], packs)).toBe(true);
    expect(isEnabledWhen([{ question: "packs", operator: "=", answerQuantity: { value: 5 } }], packs)).toBe(true);
    expect(isEnabledWhen([{ question: "packs", operator: "=" }], packs)).toBe(true);
    expect(isEnabledWhen([{ question: "packs", operator: "exists", answerString: "yes" }], packs)).toBe(true);
    expect(isEnabledWhen([{ question: "packs", operator: ">", answerString: "5" }], packs)).toBe(true);
    expect(isEnabledWhen([{ question: "missing", operator: "=", answerInteger: 1 }], packs)).toBe(true);
  });

  it("lets a decided rule win over an indeterminate one", () => {
    const smoker = answered("smoker", { valueBoolean: true });
    const broken: QuestionnaireEnableWhen = { question: "packs", operator: "~", answerInteger: 1 };
    const yes: QuestionnaireEnableWhen = { question: "smoker", operator: "=", answerBoolean: true };
    const no: QuestionnaireEnableWhen = { question: "smoker", operator: "=", answerBoolean: false };

    expect(isEnabledWhen([broken, yes], smoker)).toBe(true);
    expect(isEnabledWhen([broken, no], smoker)).toBe(true);
    expect(isEnabledWhen([broken, yes], smoker, "all")).toBe(true);
    expect(isEnabledWhen([broken, no], smoker, "all")).toBe(false);
  });

  it("resolves circular rules without looping", () => {
    const questionnaire = {
      item: [
        { linkId: "a", type: "string", enableWhen: [{ question: "b", operator: "exists", answerBoolean: false }] },
        { linkId: "b", type: "string", enableWhen: [{ question: "a", operator: "exists", answerBoolean: false }] },
      ],
    };
    expect(getEnabledItems(questionnaire, createResponse(questionnaire))).toEqual(new Set(["a", "b"]));
  });
});
