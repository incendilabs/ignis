/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { getFormNodes } from "./form-nodes";
import type { QuestionnaireItem } from "./model";
import { addItem, createResponse, setAnswer } from "./response";

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
const habits = [{ linkId: "habits", index: 0 }];
const smoker = [...habits, { linkId: "smoker", index: 0 }];

const med: QuestionnaireItem = {
  linkId: "med",
  type: "group",
  repeats: true,
  item: [{ linkId: "dose", type: "integer" }],
};

describe("getFormNodes", () => {
  it("gives each enabled item its instance, with path, answer and issue", () => {
    const issue = { path: smoker, linkId: "smoker", code: "required" as const };

    const nodes = getFormNodes({ item: items }, createResponse({ item: items }), [issue]);

    expect(nodes).toEqual([
      {
        item: items[0],
        parentPath: [],
        repeats: false,
        canRemove: false,
        instances: [{ path: [{ linkId: "intro", index: 0 }], answer: undefined, issue: undefined, children: [] }],
      },
      {
        item: items[1],
        parentPath: [],
        repeats: false,
        canRemove: false,
        instances: [
          {
            path: habits,
            answer: undefined,
            issue: undefined,
            children: [
              {
                item: items[1].item?.[0],
                parentPath: habits,
                repeats: false,
                canRemove: false,
                instances: [{ path: smoker, answer: undefined, issue, children: [] }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("adds an item once it is enabled, with its answer", () => {
    const response = setAnswer(createResponse({ item: items }), smoker, { valueBoolean: true });

    const children = getFormNodes({ item: items }, response, [])[1].instances[0].children;

    expect(children.map((node) => node.item.linkId)).toEqual(["smoker", "packs"]);
    expect(children[0].instances[0].answer).toEqual({ valueBoolean: true });
  });

  it("lets an optional repeating group drop to zero instances, a required one to one", () => {
    const one = createResponse({ item: [med] });
    const two = addItem(one, [], med);
    const required = { ...med, required: true };

    expect(getFormNodes({ item: [med] }, one, [])[0].canRemove).toBe(true);
    expect(getFormNodes({ item: [required] }, one, [])[0].canRemove).toBe(false);
    expect(getFormNodes({ item: [required] }, two, [])[0].canRemove).toBe(true);
  });

  it("gives a repeating group one instance per item in the response", () => {
    const response = addItem(createResponse({ item: [med] }), [], med);

    const [node] = getFormNodes({ item: [med] }, response, []);

    expect(node.repeats).toBe(true);
    expect(node.instances.map((instance) => instance.path)).toEqual([
      [{ linkId: "med", index: 0 }],
      [{ linkId: "med", index: 1 }],
    ]);
    expect(node.instances[1].children[0].instances[0].path).toEqual([
      { linkId: "med", index: 1 },
      { linkId: "dose", index: 0 },
    ]);
  });
});
