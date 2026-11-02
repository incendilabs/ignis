/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import type { QuestionnaireItem } from "./model";
import { addItem, createResponse, removeItem, setAnswer } from "./response";
import { pathOf } from "./test-support";
import { validateResponse } from "./validate";

const items: QuestionnaireItem[] = [
  { linkId: "heading", type: "display", required: true },
  {
    linkId: "g1",
    type: "group",
    required: true,
    item: [
      { linkId: "name", type: "string", required: true },
      { linkId: "nickname", type: "string" },
    ],
  },
  { linkId: "smoker", type: "boolean", required: true },
  {
    linkId: "packs",
    type: "integer",
    required: true,
    enableWhen: [{ question: "smoker", operator: "=", answerBoolean: true }],
  },
];

function linkIds(questionnaire: QuestionnaireItem[], answers: Record<string, boolean | string>): string[] {
  let response = createResponse({ item: questionnaire });
  for (const [linkId, value] of Object.entries(answers)) {
    const answer = typeof value === "boolean" ? { valueBoolean: value } : { valueString: value };
    response = setAnswer(response, pathOf(questionnaire, linkId), answer);
  }
  return validateResponse({ item: questionnaire }, response).map((issue) => issue.linkId);
}

describe("validateResponse", () => {
  it("reports unanswered required questions and groups, not display items", () => {
    const issues = validateResponse({ item: items }, createResponse({ item: items }));

    expect(issues).toEqual([
      { path: [{ linkId: "g1", index: 0 }], linkId: "g1", code: "required" },
      { path: [{ linkId: "g1", index: 0 }, { linkId: "name", index: 0 }], linkId: "name", code: "required" },
      { path: [{ linkId: "smoker", index: 0 }], linkId: "smoker", code: "required" },
    ]);
  });

  it("includes a required question once its enableWhen holds", () => {
    expect(linkIds(items, { smoker: true })).toEqual(["g1", "name", "packs"]);
  });

  it("is clean when every enabled required question is answered", () => {
    expect(linkIds(items, { name: "Ada", smoker: false })).toEqual([]);
  });

  it("satisfies a required group with any answered question below it", () => {
    const nested: QuestionnaireItem[] = [
      {
        linkId: "outer",
        type: "group",
        required: true,
        item: [{ linkId: "inner", type: "group", item: [{ linkId: "q", type: "string" }] }],
      },
    ];
    expect(linkIds(nested, {})).toEqual(["outer"]);
    expect(linkIds(nested, { q: "x" })).toEqual([]);
  });

  it("does not let an answer on a disabled question satisfy a required group", () => {
    const guarded: QuestionnaireItem[] = [
      { linkId: "smoker", type: "boolean" },
      {
        linkId: "g",
        type: "group",
        required: true,
        item: [{
          linkId: "packs",
          type: "string",
          enableWhen: [{ question: "smoker", operator: "=", answerBoolean: true }],
        }],
      },
    ];
    expect(linkIds(guarded, { smoker: true, packs: "2" })).toEqual([]);
    expect(linkIds(guarded, { smoker: false, packs: "2" })).toEqual(["g"]);
  });

  describe("repeating groups", () => {
    const med: QuestionnaireItem = {
      linkId: "med",
      type: "group",
      repeats: true,
      required: true,
      item: [{ linkId: "drug", type: "string", required: true }],
    };
    const drug = (index: number) => [{ linkId: "med", index }, { linkId: "drug", index: 0 }];

    it("checks every instance", () => {
      let response = addItem(createResponse({ item: [med] }), [], med);
      response = setAnswer(response, drug(0), { valueString: "Paracetamol" });

      expect(validateResponse({ item: [med] }, response)).toEqual([
        { path: [{ linkId: "med", index: 1 }], linkId: "med", code: "required" },
        { path: drug(1), linkId: "drug", code: "required" },
      ]);
    });

    it("accepts an optional group with no instances", () => {
      const optional = { ...med, required: false };
      const response = removeItem(createResponse({ item: [optional] }), [{ linkId: "med", index: 0 }]);

      expect(validateResponse({ item: [optional] }, response)).toEqual([]);
    });

    it("requires at least one instance of a required group", () => {
      const response = removeItem(createResponse({ item: [med] }), [{ linkId: "med", index: 0 }]);

      expect(validateResponse({ item: [med] }, response)).toEqual([
        { path: [{ linkId: "med", index: 0 }], linkId: "med", code: "required" },
      ]);
    });
  });
});
