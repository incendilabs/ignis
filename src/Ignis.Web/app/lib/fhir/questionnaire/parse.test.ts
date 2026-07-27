/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { parseQuestionnaireItems } from "./parse";

describe("parseQuestionnaireItems", () => {
  it("returns [] for a non-Questionnaire resource", () => {
    const resource = { resourceType: "Patient", item: [{ linkId: "1" }] };
    expect(parseQuestionnaireItems(resource)).toEqual([]);
  });

  it("returns [] when there are no items", () => {
    expect(parseQuestionnaireItems({ resourceType: "Questionnaire" })).toEqual([]);
    expect(
      parseQuestionnaireItems({ resourceType: "Questionnaire", item: "nonsense" }),
    ).toEqual([]);
  });

  it("builds the nested item tree", () => {
    const items = parseQuestionnaireItems({
      resourceType: "Questionnaire",
      item: [
        {
          linkId: "group1",
          type: "group",
          text: "Demographics",
          item: [{ linkId: "q1", type: "string", text: "Name" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ linkId: "group1", type: "group", text: "Demographics" });
    expect(items[0].item).toHaveLength(1);
    expect(items[0].item?.[0]).toMatchObject({ linkId: "q1", type: "string", text: "Name" });
  });

  it("captures required / repeats / readOnly flags", () => {
    const [item] = parseQuestionnaireItems({
      resourceType: "Questionnaire",
      item: [{ linkId: "q1", type: "boolean", required: true, repeats: false, readOnly: true }],
    });

    expect(item).toMatchObject({ required: true, repeats: false, readOnly: true });
  });

  it("captures answerValueSet and answerOption", () => {
    const [byValueSet, byOption] = parseQuestionnaireItems({
      resourceType: "Questionnaire",
      item: [
        { linkId: "q1", type: "choice", answerValueSet: "http://x/vs|1.0.0" },
        {
          linkId: "q2",
          type: "choice",
          answerOption: [
            { valueCoding: { system: "http://x", code: "a", display: "A" } },
            { valueString: "other" },
          ],
        },
      ],
    });

    expect(byValueSet.answerValueSet).toBe("http://x/vs|1.0.0");
    expect(byOption.answerOption).toHaveLength(2);
    expect(byOption.answerOption?.[0].valueCoding).toEqual({
      system: "http://x",
      code: "a",
      display: "A",
    });
    expect(byOption.answerOption?.[1].valueString).toBe("other");
  });

  it("drops answerOption entries with no value[x]", () => {
    const [item] = parseQuestionnaireItems({
      resourceType: "Questionnaire",
      item: [
        {
          linkId: "q1",
          type: "choice",
          answerOption: [{ valueString: "keep" }, { initialSelected: true }, {}],
        },
      ],
    });
    expect(item.answerOption).toHaveLength(1);
    expect(item.answerOption?.[0].valueString).toBe("keep");
  });

  it("captures enableWhen rules", () => {
    const [item] = parseQuestionnaireItems({
      resourceType: "Questionnaire",
      item: [
        {
          linkId: "q2",
          type: "string",
          enableWhen: [{ question: "q1", operator: "=", answerBoolean: true }],
        },
      ],
    });

    expect(item.enableWhen).toHaveLength(1);
    expect(item.enableWhen?.[0]).toMatchObject({ question: "q1", operator: "=", answerBoolean: true });
  });

  it("defaults missing linkId/type to empty strings and drops non-object entries", () => {
    const items = parseQuestionnaireItems({
      resourceType: "Questionnaire",
      item: [{ text: "No linkId or type" }, "garbage", null, { linkId: "ok", type: "display" }],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ linkId: "", type: "" });
    expect(items[1]).toMatchObject({ linkId: "ok", type: "display" });
  });
});
