/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { createEnabledItemCheck } from "./enable-when";
import type { QuestionnaireEnableWhen, QuestionnaireItem } from "./model";
import { addItem, createResponse, type QuestionnaireResponse, type QuestionnaireResponseAnswer, setAnswer } from "./response";
import { pathOf } from "./test-support";

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
  return createEnabledItemCheck({ item: [...questions, q] }, response)([], "q");
}

function answered(linkId: string, answer: QuestionnaireResponseAnswer): QuestionnaireResponse {
  return setAnswer(createResponse({ item: questions }), pathOf(questions, linkId), answer);
}

const unanswered = createResponse({ item: questions });

describe("createEnabledItemCheck", () => {
  it("enables items without rules", () => {
    const isItemEnabled = createEnabledItemCheck({ item: questions }, unanswered);
    expect(questions.map((question) => isItemEnabled([], question.linkId))).toEqual([true, true, true, true]);
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
    expect(isEnabledWhen(rules, setAnswer(smokerOnly, pathOf(questions, "packs"), { valueInteger: 2 }), "all")).toBe(true);
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
    const g = [{ linkId: "g", index: 0 }];
    expect(createEnabledItemCheck(questionnaire, unanswered)(g, "q")).toBe(false);
    expect(createEnabledItemCheck(questionnaire, answered("smoker", { valueBoolean: true }))(g, "q")).toBe(true);
  });

  it("treats a disabled question as unanswered", () => {
    const questionnaire = {
      item: [
        { linkId: "smoker", type: "boolean" },
        { linkId: "packs", type: "integer", enableWhen: [{ question: "smoker", operator: "=", answerBoolean: true }] },
        { linkId: "q", type: "string", enableWhen: [{ question: "packs", operator: ">", answerInteger: 0 }] },
      ],
    };
    let response = setAnswer(createResponse(questionnaire), pathOf(questionnaire.item, "smoker"), { valueBoolean: true });
    response = setAnswer(response, pathOf(questionnaire.item, "packs"), { valueInteger: 5 });
    expect(createEnabledItemCheck(questionnaire, response)([], "q")).toBe(true);

    response = setAnswer(response, pathOf(questionnaire.item, "smoker"), { valueBoolean: false });
    const isItemEnabled = createEnabledItemCheck(questionnaire, response);
    expect(["smoker", "packs", "q"].map((linkId) => isItemEnabled([], linkId))).toEqual([true, false, false]);
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

  it("resolves circular rules the same way whichever item is asked for first", () => {
    const questionnaire = {
      item: [
        {
          linkId: "g",
          type: "group",
          item: [{ linkId: "a", type: "string", enableWhen: [{ question: "b", operator: "exists", answerBoolean: false }] }],
        },
        { linkId: "b", type: "string", enableWhen: [{ question: "a", operator: "exists", answerBoolean: false }] },
      ],
    };
    const a = pathOf(questionnaire.item, "a");
    let response = setAnswer(createResponse(questionnaire), a, { valueString: "yes" });
    response = setAnswer(response, pathOf(questionnaire.item, "b"), { valueString: "yes" });

    const askedForBFirst = createEnabledItemCheck(questionnaire, response);
    const bFirst = { b: askedForBFirst([], "b"), a: askedForBFirst(a.slice(0, -1), "a") };
    const askedForAFirst = createEnabledItemCheck(questionnaire, response);
    const aFirst = { a: askedForAFirst(a.slice(0, -1), "a"), b: askedForAFirst([], "b") };

    expect(aFirst).toEqual(bFirst);
  });

  it("reads the children of every answer of a repeating question", () => {
    const questionnaire = {
      item: [
        { linkId: "drug", type: "string", repeats: true, item: [{ linkId: "dose", type: "integer" }] },
        { linkId: "q", type: "string", enableWhen: [{ question: "dose", operator: "exists", answerBoolean: true }] },
      ],
    };
    const response: QuestionnaireResponse = {
      resourceType: "QuestionnaireResponse",
      status: "in-progress",
      item: [{
        linkId: "drug",
        answer: [
          { valueString: "A", item: [{ linkId: "dose" }] },
          { valueString: "B", item: [{ linkId: "dose", answer: [{ valueInteger: 2 }] }] },
        ],
      }],
    };

    expect(createEnabledItemCheck(questionnaire, response)([], "q")).toBe(true);
    expect(createEnabledItemCheck(questionnaire, createResponse(questionnaire))([], "q")).toBe(false);
  });

  it("resolves circular rules without looping", () => {
    const questionnaire = {
      item: [
        { linkId: "a", type: "string", enableWhen: [{ question: "b", operator: "exists", answerBoolean: false }] },
        { linkId: "b", type: "string", enableWhen: [{ question: "a", operator: "exists", answerBoolean: false }] },
      ],
    };
    const isItemEnabled = createEnabledItemCheck(questionnaire, createResponse(questionnaire));
    expect(isItemEnabled([], "a")).toBe(true);
    expect(isItemEnabled([], "b")).toBe(true);
  });

  describe("repeating groups", () => {
    const meds: QuestionnaireItem = {
      linkId: "meds",
      type: "group",
      repeats: true,
      item: [
        { linkId: "prn", type: "boolean" },
        { linkId: "reason", type: "string", enableWhen: [{ question: "prn", operator: "=", answerBoolean: true }] },
        {
          linkId: "unit",
          type: "string",
          enableWhen: [{ question: "smoker", operator: "=", answerBoolean: true }],
        },
      ],
    };
    const items = [...questions, meds];
    const med = (index: number) => [{ linkId: "meds", index }];
    const prn = (index: number) => [...med(index), { linkId: "prn", index: 0 }];
    const twoMeds = addItem(createResponse({ item: items }), [], meds);

    it("follows the answer in the same instance", () => {
      const response = setAnswer(twoMeds, prn(1), { valueBoolean: true });
      const isItemEnabled = createEnabledItemCheck({ item: items }, response);

      expect(isItemEnabled(med(0), "reason")).toBe(false);
      expect(isItemEnabled(med(1), "reason")).toBe(true);
    });

    it("follows the answer in the same instance when the question is an ancestor", () => {
      const reason: QuestionnaireItem = {
        linkId: "reason",
        type: "string",
        enableWhen: [{ question: "prn", operator: "=", answerBoolean: true }],
      };
      const prnWithChild: QuestionnaireItem = { ...meds, item: [{ linkId: "prn", type: "boolean", item: [reason] }] };
      let response = addItem(createResponse({ item: [prnWithChild] }), [], prnWithChild);
      response = setAnswer(response, prn(0), { valueBoolean: true });
      const isItemEnabled = createEnabledItemCheck({ item: [prnWithChild] }, response);

      expect(isItemEnabled(prn(0), "reason")).toBe(true);
      expect(isItemEnabled(prn(1), "reason")).toBe(false);
    });

    it("reads a question outside the group once for every instance", () => {
      const response = setAnswer(twoMeds, pathOf(items, "smoker"), { valueBoolean: true });
      const isItemEnabled = createEnabledItemCheck({ item: items }, response);

      expect(isItemEnabled(med(0), "unit")).toBe(true);
      expect(isItemEnabled(med(1), "unit")).toBe(true);
    });

    it("lets a question outside the group see every instance", () => {
      const anyPrn: QuestionnaireItem = {
        linkId: "warn",
        type: "display",
        enableWhen: [{ question: "prn", operator: "=", answerBoolean: true }],
      };
      const questionnaire = { item: [...items, anyPrn] };
      const response = setAnswer(twoMeds, prn(1), { valueBoolean: true });

      expect(createEnabledItemCheck(questionnaire, twoMeds)([], "warn")).toBe(false);
      expect(createEnabledItemCheck(questionnaire, response)([], "warn")).toBe(true);
    });
  });
});
