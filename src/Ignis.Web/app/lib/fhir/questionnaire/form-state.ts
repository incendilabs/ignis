/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Questionnaire } from "./model";
import {
  createResponse,
  type QuestionnaireResponse,
  type QuestionnaireResponseAnswer,
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
  | { type: "check"; };

export function createFormState(questionnaire: Pick<Questionnaire, "url" | "version" | "item">): FormState {
  return { response: createResponse(questionnaire), showIssues: false };
}

export function reduceFormState(state: FormState, event: FormEvent): FormState {
  switch (event.type) {
    case "setAnswer": {
      const response = setAnswer(state.response, event.path, event.answer);
      return response === state.response ? state : { ...state, response };
    }
    case "check":
      return state.showIssues ? state : { ...state, showIssues: true };
  }
}

export function getFormIssues(questionnaire: Pick<Questionnaire, "item">, state: FormState): ResponseIssue[] {
  return state.showIssues ? validateResponse(questionnaire, state.response) : [];
}
