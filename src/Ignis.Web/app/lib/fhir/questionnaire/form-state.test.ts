/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import type { QuestionnaireItem } from "./model";
import { getAnswersAt } from "./response";
import { createFormState, getFormIssues, reduceFormState } from "./form-state";

const items: QuestionnaireItem[] = [{ linkId: "name", type: "string", text: "Name" }];
const name = [{ linkId: "name", index: 0 }];

describe("createFormState", () => {
  it("starts with an empty response and hides issues", () => {
    const state = createFormState({ url: "http://x/q", item: items });

    expect(state.showIssues).toBe(false);
    expect(state.response).toEqual({
      resourceType: "QuestionnaireResponse",
      status: "in-progress",
      questionnaire: "http://x/q",
      item: [{ linkId: "name", text: "Name" }],
    });
  });
});

describe("reduceFormState", () => {
  it("sets an answer at a path", () => {
    const state = reduceFormState(createFormState({ item: items }), {
      type: "setAnswer",
      path: name,
      answer: { valueString: "Ada" },
    });

    expect(getAnswersAt(state.response, name)).toEqual([{ valueString: "Ada" }]);
  });

  it("shows issues after a check", () => {
    const state = reduceFormState(createFormState({ item: items }), { type: "check" });
    expect(state.showIssues).toBe(true);
  });

  it("returns the same state when nothing changes", () => {
    const initial = createFormState({ item: items });
    const checked = reduceFormState(initial, { type: "check" });

    expect(reduceFormState(initial, { type: "setAnswer", path: [{ linkId: "nope", index: 0 }], answer: { valueString: "x" } })).toBe(initial);
    expect(reduceFormState(checked, { type: "check" })).toBe(checked);
  });
});

describe("getFormIssues", () => {
  const required: QuestionnaireItem[] = [{ linkId: "name", type: "string", required: true }];

  it("is empty until a check", () => {
    const initial = createFormState({ item: required });

    expect(getFormIssues({ item: required }, initial)).toEqual([]);
    expect(getFormIssues({ item: required }, reduceFormState(initial, { type: "check" }))).toEqual([
      { path: name, linkId: "name", code: "required" },
    ]);
  });
});
