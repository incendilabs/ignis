/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { resolveAnswerChoices } from "./answers";
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

  it("flattens inline answerOption (coding and string)", () => {
    const choices = resolveAnswerChoices(
      emptyQuestionnaire,
      item({
        answerOption: [
          { valueCoding: { system: "http://x", code: "a", display: "Alpha" } },
          { valueString: "Other" },
        ],
      }),
    );
    expect(choices).toEqual([
      { code: "a", display: "Alpha", system: "http://x", label: "Alpha" },
      { display: "Other", label: "Other" },
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
      { code: "LA1", display: "Oriented", system: "http://loinc.org", label: "Oriented" },
      { code: "LA2", display: "Confused", system: "http://loinc.org", label: "Confused" },
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
      { code: "LA3", display: "Spontaneous", system: "http://loinc.org", label: "Spontaneous" },
    ]);
  });

  it("returns null when the contained ValueSet is missing", () => {
    expect(resolveAnswerChoices(emptyQuestionnaire, item({ answerValueSet: "#nope" }))).toBeNull();
  });
});
