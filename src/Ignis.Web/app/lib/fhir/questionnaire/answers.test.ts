/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import {
  getExternalAnswerValueSets,
  findAnswerChoiceIndex,
  isSameAnswer,
  resolveAnswerChoices,
  valueSetToAnswerChoices,
} from "./answers";
import type { QuestionnaireItem } from "./model";

const emptyQuestionnaire = { resourceType: "Questionnaire" };

function item(overrides: Partial<QuestionnaireItem>): QuestionnaireItem {
  return { linkId: "q", type: "choice", ...overrides };
}

describe("resolveAnswerChoices", () => {
  it("returns null when the item has no answers", () => {
    expect(resolveAnswerChoices(emptyQuestionnaire, item({ type: "string" }))).toBeNull();
  });

  it("returns null for a non-choice item even with answerOption", () => {
    expect(
      resolveAnswerChoices(
        emptyQuestionnaire,
        item({ type: "group", answerOption: [{ valueString: "x" }] }),
      ),
    ).toBeNull();
  });

  it("returns null for an external (non-contained) answerValueSet", () => {
    expect(
      resolveAnswerChoices(emptyQuestionnaire, item({ answerValueSet: "http://x/vs|1.0.0" })),
    ).toBeNull();
  });

  it("keeps the type of inline answerOption values", () => {
    const choices = resolveAnswerChoices(
      emptyQuestionnaire,
      item({
        answerOption: [
          { valueCoding: { system: "http://x", code: "a", display: "Alpha" } },
          { valueString: "Other" },
          { valueInteger: 3 },
        ],
      }),
    );
    expect(choices).toEqual([
      { label: "Alpha", answer: { valueCoding: { system: "http://x", code: "a", display: "Alpha" } } },
      { label: "Other", answer: { valueString: "Other" } },
      { label: "3", answer: { valueInteger: 3 } },
    ]);
  });

  it("keeps extensions on inline answerOption", () => {
    const ordinal = { url: "http://example.test/ordinal", valueDecimal: 3 };
    const choices = resolveAnswerChoices(
      emptyQuestionnaire,
      item({ answerOption: [{ valueCoding: { code: "a" }, extension: [ordinal] }] }),
    );
    expect(choices?.[0].extension).toEqual([ordinal]);
  });

  it("resolves a contained answerValueSet via compose.include.concept", () => {
    const resource = {
      resourceType: "Questionnaire",
      contained: [
        {
          resourceType: "ValueSet",
          id: "verbal",
          compose: {
            include: [
              {
                system: "http://loinc.org",
                concept: [
                  { code: "LA1", display: "Oriented" },
                  { code: "LA2", display: "Confused" },
                ],
              },
            ],
          },
        },
      ],
    };
    const choices = resolveAnswerChoices(resource, item({ answerValueSet: "#verbal" }));
    expect(choices).toEqual([
      { label: "Oriented", answer: { valueCoding: { system: "http://loinc.org", code: "LA1", display: "Oriented" } } },
      { label: "Confused", answer: { valueCoding: { system: "http://loinc.org", code: "LA2", display: "Confused" } } },
    ]);
  });

  it("prefers a precomputed expansion over compose", () => {
    const resource = {
      resourceType: "Questionnaire",
      contained: [
        {
          resourceType: "ValueSet",
          id: "eye",
          expansion: { contains: [{ system: "http://loinc.org", code: "LA3", display: "Spontaneous" }] },
          compose: { include: [{ concept: [{ code: "ignored" }] }] },
        },
      ],
    };
    const choices = resolveAnswerChoices(resource, item({ answerValueSet: "#eye" }));
    expect(choices).toEqual([
      { label: "Spontaneous", answer: { valueCoding: { system: "http://loinc.org", code: "LA3", display: "Spontaneous" } } },
    ]);
  });

  it("returns null when the contained ValueSet is missing", () => {
    expect(resolveAnswerChoices(emptyQuestionnaire, item({ answerValueSet: "#nope" }))).toBeNull();
  });
});

describe("getExternalAnswerValueSets", () => {
  it("collects distinct external canonicals across nested items, in document order", () => {
    const canonicals = getExternalAnswerValueSets([
      item({ answerValueSet: "http://x/vs-b" }),
      item({
        type: "group",
        item: [
          item({ answerValueSet: "http://x/vs-a|1.0.0" }),
          item({ answerValueSet: "http://x/vs-b" }),
          item({ type: "open-choice", answerValueSet: "http://x/vs-c" }),
        ],
      }),
    ]);
    expect(canonicals).toEqual(["http://x/vs-b", "http://x/vs-a|1.0.0", "http://x/vs-c"]);
  });

  it("skips contained ValueSets, inline answerOption and non-choice items", () => {
    const canonicals = getExternalAnswerValueSets([
      item({ answerValueSet: "#local" }),
      item({ answerValueSet: "http://x/vs", answerOption: [{ valueString: "x" }] }),
      item({ type: "string", answerValueSet: "http://x/vs" }),
    ]);
    expect(canonicals).toEqual([]);
  });
});

describe("valueSetToAnswerChoices", () => {
  it("prefers the expansion over compose", () => {
    const choices = valueSetToAnswerChoices({
      expansion: { contains: [{ system: "http://x", code: "e", display: "Expanded" }] },
      compose: { include: [{ system: "http://x", concept: [{ code: "c" }] }] },
    });
    expect(choices).toEqual([{ label: "Expanded", answer: { valueCoding: { system: "http://x", code: "e", display: "Expanded" } } }]);
  });

  it("is empty for a ValueSet with neither", () => {
    expect(valueSetToAnswerChoices({ resourceType: "ValueSet" })).toEqual([]);
  });
});

describe("isSameAnswer", () => {
  it("matches codings on system and code, ignoring display", () => {
    const answer = { valueCoding: { system: "http://x", code: "a", display: "Alpha" } };
    expect(isSameAnswer(answer, { valueCoding: { system: "http://x", code: "a" } })).toBe(true);
    expect(isSameAnswer(answer, { valueCoding: { system: "http://y", code: "a" } })).toBe(false);
  });

  it("matches other values on type and value", () => {
    expect(isSameAnswer({ valueInteger: 3 }, { valueInteger: 3 })).toBe(true);
    expect(isSameAnswer({ valueInteger: 3 }, { valueString: "3" })).toBe(false);
  });
});

describe("findAnswerChoiceIndex", () => {
  const choices = [
    { label: "Alpha", answer: { valueCoding: { system: "http://x", code: "a" } } },
    { label: "3", answer: { valueInteger: 3 } },
  ];

  it("finds the choice giving the answer", () => {
    expect(findAnswerChoiceIndex(choices, { valueInteger: 3 })).toBe(1);
  });

  it("is -1 when no choice matches or there is no answer", () => {
    expect(findAnswerChoiceIndex(choices, { valueString: "3" })).toBe(-1);
    expect(findAnswerChoiceIndex(choices, undefined)).toBe(-1);
  });
});
