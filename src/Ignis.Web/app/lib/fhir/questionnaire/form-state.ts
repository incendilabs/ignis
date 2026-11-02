/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Questionnaire, QuestionnaireItem } from "./model";
import {
  addItem,
  createResponse,
  type QuestionnaireResponse,
  type QuestionnaireResponseAnswer,
  removeItem,
  type ResponsePath,
  setAnswer,
} from "./response";
import { type ResponseIssue, validateResponse } from "./validate";

export interface FormState {
  response: QuestionnaireResponse;
  showIssues: boolean;
}

export type FormEvent =
  | { type: "setAnswer"; path: ResponsePath; answer: QuestionnaireResponseAnswer | undefined; }
  | { type: "addItem"; parentPath: ResponsePath; item: QuestionnaireItem; }
  | { type: "removeItem"; path: ResponsePath; }
  | { type: "check"; };

export function createFormState(questionnaire: Pick<Questionnaire, "url" | "version" | "item">): FormState {
  return { response: createResponse(questionnaire), showIssues: false };
}

export function reduceFormState(state: FormState, event: FormEvent): FormState {
  switch (event.type) {
    case "setAnswer":
      return replaceResponseIfChanged(state, setAnswer(state.response, event.path, event.answer));
    case "addItem":
      return replaceResponseIfChanged(state, addItem(state.response, event.parentPath, event.item));
    case "removeItem":
      return replaceResponseIfChanged(state, removeItem(state.response, event.path));
    case "check":
      return state.showIssues ? state : { ...state, showIssues: true };
  }
}

function replaceResponseIfChanged(state: FormState, response: QuestionnaireResponse): FormState {
  return response === state.response ? state : { ...state, response };
}

export function getFormIssues(questionnaire: Pick<Questionnaire, "item">, state: FormState): ResponseIssue[] {
  return state.showIssues ? validateResponse(questionnaire, state.response) : [];
}
