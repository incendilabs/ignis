/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import type { QuestionnaireItem } from "./model";
import {
  createResponse,
  pathToKey,
  getAnswers,
  getAnswersAt,
  pruneEmptyItems,
  type QuestionnaireResponse,
  setAnswer,
} from "./response";
import { pathOf } from "./test-support";

const items: QuestionnaireItem[] = [
  { linkId: "intro", type: "display", text: "Welcome" },
  {
    linkId: "g1",
    type: "group",
    text: "About you",
    item: [
      { linkId: "name", type: "string", text: "Name" },
      {
        linkId: "smoker",
        type: "boolean",
        text: "Smoker?",
        item: [{ linkId: "packs", type: "integer", text: "Packs a day" }],
      },
    ],
  },
  { linkId: "notes", type: "text" },
];

const name = pathOf(items, "name");
const smoker = pathOf(items, "smoker");
const packs = pathOf(items, "packs");

/** Two instances of a repeating group, as a server could return them. */
const twoMeds: QuestionnaireResponse = {
  resourceType: "QuestionnaireResponse",
  status: "in-progress",
  item: [
    { linkId: "med", item: [{ linkId: "dose", answer: [{ valueInteger: 1 }] }] },
    { linkId: "med", item: [{ linkId: "dose" }] },
  ],
};
const dose = (index: number) => [{ linkId: "med", index }, { linkId: "dose", index: 0 }];

describe("createResponse", () => {
  it("mirrors the items, without display items, and references the questionnaire", () => {
    const response = createResponse({ url: "http://x/q", version: "2.0.0", item: items });

    expect(response).toEqual({
      resourceType: "QuestionnaireResponse",
      status: "in-progress",
      questionnaire: "http://x/q|2.0.0",
      item: [
        {
          linkId: "g1",
          text: "About you",
          item: [
            { linkId: "name", text: "Name" },
            { linkId: "smoker", text: "Smoker?", item: [{ linkId: "packs", text: "Packs a day" }] },
          ],
        },
        { linkId: "notes" },
      ],
    });
  });

  it("leaves out questionnaire and item when there is nothing to put there", () => {
    expect(createResponse({})).toEqual({ resourceType: "QuestionnaireResponse", status: "in-progress" });
  });
});

describe("setAnswer", () => {
  it("answers a nested item without touching the original response", () => {
    const empty = createResponse({ item: items });

    const answered = setAnswer(empty, name, { valueString: "Ada" });

    expect(getAnswersAt(answered, name)).toEqual([{ valueString: "Ada" }]);
    expect(getAnswersAt(empty, name)).toEqual([]);
  });

  it("replaces an earlier answer and clears it with undefined", () => {
    let response = setAnswer(createResponse({ item: items }), name, { valueString: "Ada" });
    response = setAnswer(response, name, { valueString: "Grace" });
    expect(getAnswersAt(response, name)).toEqual([{ valueString: "Grace" }]);

    response = setAnswer(response, name, undefined);
    expect(getAnswersAt(response, name)).toEqual([]);
    expect(response.item?.[0].item?.[0]).toEqual({ linkId: "name", text: "Name" });
  });

  it("treats an answer without a value, or with blank text, as cleared", () => {
    const answered = setAnswer(createResponse({ item: items }), name, { valueString: "Ada" });

    for (const empty of [{}, { valueString: "" }, { valueString: "  \n" }]) {
      const cleared = setAnswer(answered, name, empty);
      expect(getAnswersAt(cleared, name)).toEqual([]);
      expect(cleared.item?.[0].item?.[0]).toEqual({ linkId: "name", text: "Name" });
    }
  });

  it("moves a question's children into the answer and back (qrs-1)", () => {
    let response = setAnswer(createResponse({ item: items }), smoker, { valueBoolean: true });
    expect(response.item?.[0].item?.[1]).toEqual({
      linkId: "smoker",
      text: "Smoker?",
      answer: [{ valueBoolean: true, item: [{ linkId: "packs", text: "Packs a day" }] }],
    });

    response = setAnswer(response, packs, { valueInteger: 2 });
    expect(getAnswersAt(response, packs)).toEqual([{ valueInteger: 2 }]);

    response = setAnswer(response, smoker, undefined);
    expect(response.item?.[0].item?.[1]).toEqual({
      linkId: "smoker",
      text: "Smoker?",
      item: [{ linkId: "packs", text: "Packs a day", answer: [{ valueInteger: 2 }] }],
    });
  });

  it("copies only the path to the item, so siblings keep their identity", () => {
    const empty = createResponse({ item: items });

    const answered = setAnswer(empty, name, { valueString: "Ada" });

    expect(answered.item?.[0]).not.toBe(empty.item?.[0]);
    expect(answered.item?.[0].item?.[1]).toBe(empty.item?.[0].item?.[1]);
    expect(answered.item?.[1]).toBe(empty.item?.[1]);
  });

  it("returns the response itself for an unknown path", () => {
    const response = createResponse({ item: items });
    expect(setAnswer(response, [{ linkId: "nope", index: 0 }], { valueString: "x" })).toBe(response);
    expect(setAnswer(response, [...name, { linkId: "deeper", index: 0 }], { valueString: "x" })).toBe(response);
  });

  it("tells the instances of a repeating group apart by index", () => {
    const response = setAnswer(twoMeds, dose(1), { valueInteger: 2 });

    expect(getAnswersAt(response, dose(0))).toEqual([{ valueInteger: 1 }]);
    expect(getAnswersAt(response, dose(1))).toEqual([{ valueInteger: 2 }]);
    expect(getAnswersAt(response, dose(2))).toEqual([]);
    expect(response.item?.[0]).toBe(twoMeds.item?.[0]);
  });
});

describe("getAnswers", () => {
  it("skips answers without a value", () => {
    const response: QuestionnaireResponse = {
      resourceType: "QuestionnaireResponse",
      status: "in-progress",
      item: [{ linkId: "q", answer: [{ item: [{ linkId: "child" }] }, { valueString: " " }, { valueInteger: 0 }] }],
    };
    expect(getAnswers(response, "q")).toEqual([{ valueInteger: 0 }]);
  });

  it("collects the answers of every instance of a linkId", () => {
    const response = setAnswer(twoMeds, dose(1), { valueInteger: 2 });
    expect(getAnswers(response, "dose")).toEqual([{ valueInteger: 1 }, { valueInteger: 2 }]);
  });
});

describe("pathToKey", () => {
  it("writes each segment as linkId[index]", () => {
    expect(pathToKey(dose(1))).toBe("med[1]/dose[0]");
    expect(pathToKey([])).toBe("");
  });
});

describe("pruneEmptyItems", () => {
  it("keeps only answered items and the groups that lead to them", () => {
    const response = setAnswer(createResponse({ item: items }), smoker, { valueBoolean: false });

    expect(pruneEmptyItems(response).item).toEqual([
      { linkId: "g1", text: "About you", item: [{ linkId: "smoker", text: "Smoker?", answer: [{ valueBoolean: false }] }] },
    ]);
  });

  it("prunes the children of an answer too", () => {
    let response = setAnswer(createResponse({ item: items }), smoker, { valueBoolean: true });
    response = setAnswer(response, packs, { valueInteger: 2 });

    expect(pruneEmptyItems(response).item?.[0].item).toEqual([
      {
        linkId: "smoker",
        text: "Smoker?",
        answer: [{ valueBoolean: true, item: [{ linkId: "packs", text: "Packs a day", answer: [{ valueInteger: 2 }] }] }],
      },
    ]);
  });

  it("drops item altogether when nothing is answered", () => {
    expect(pruneEmptyItems(createResponse({ item: items }))).toEqual({
      resourceType: "QuestionnaireResponse",
      status: "in-progress",
    });
  });
});
