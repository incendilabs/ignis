/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import type { QuestionnaireItem } from "./model";
import { createResponse, setAnswer } from "./response";
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
    response = setAnswer(response, linkId, typeof value === "boolean" ? { valueBoolean: value } : { valueString: value });
  }
  return validateResponse({ item: questionnaire }, response).map((issue) => issue.linkId);
}

describe("validateResponse", () => {
  it("reports unanswered required questions and groups, not display items", () => {
    const issues = validateResponse({ item: items }, createResponse({ item: items }));

    expect(issues).toEqual([
      { linkId: "g1", code: "required" },
      { linkId: "name", code: "required" },
      { linkId: "smoker", code: "required" },
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
});
