/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { getFormNodes } from "./form-nodes";
import type { QuestionnaireItem } from "./model";
import { createResponse, setAnswer } from "./response";

const items: QuestionnaireItem[] = [
  { linkId: "intro", type: "display", text: "Welcome" },
  {
    linkId: "habits",
    type: "group",
    item: [
      { linkId: "smoker", type: "boolean", required: true },
      {
        linkId: "packs",
        type: "integer",
        enableWhen: [{ question: "smoker", operator: "=", answerBoolean: true }],
      },
    ],
  },
];
const smoker = [{ linkId: "habits", index: 0 }, { linkId: "smoker", index: 0 }];

describe("getFormNodes", () => {
  it("gives each enabled item its path, answer and issue", () => {
    const issue = { path: smoker, linkId: "smoker", code: "required" as const };

    const nodes = getFormNodes({ item: items }, createResponse({ item: items }), [issue]);

    expect(nodes).toEqual([
      { item: items[0], path: [{ linkId: "intro", index: 0 }], answer: undefined, issue: undefined, children: [] },
      {
        item: items[1],
        path: [{ linkId: "habits", index: 0 }],
        answer: undefined,
        issue: undefined,
        children: [{ item: items[1].item?.[0], path: smoker, answer: undefined, issue, children: [] }],
      },
    ]);
  });

  it("adds an item once it is enabled, with its answer", () => {
    const response = setAnswer(createResponse({ item: items }), smoker, { valueBoolean: true });

    const habits = getFormNodes({ item: items }, response, [])[1];

    expect(habits.children.map((node) => node.item.linkId)).toEqual(["smoker", "packs"]);
    expect(habits.children[0].answer).toEqual({ valueBoolean: true });
  });
});
