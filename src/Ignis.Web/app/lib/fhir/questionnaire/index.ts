/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

export type {
  Questionnaire,
  QuestionnaireEnableWhen,
  QuestionnaireItem,
  QuestionnaireItemAnswerOption,
  QuestionnaireItemType,
} from "./model";
export { parseQuestionnaireExtensions, parseQuestionnaireItems } from "./parse";
export type { AnswerChoice } from "./answers";
export {
  findAnswerChoiceIndex,
  getExternalAnswerValueSets,
  hasExternalAnswerValueSet,
  resolveAnswerChoices,
  valueSetToAnswerChoices,
} from "./answers";

export type {
  PathSegment,
  QuestionnaireResponse,
  QuestionnaireResponseAnswer,
  QuestionnaireResponseItem,
  QuestionnaireResponseStatus,
  ResponsePath,
} from "./response";
export { createResponse, pruneEmptyItems, setAnswer } from "./response";
export type { ResponseIssue } from "./validate";
export { validateResponse } from "./validate";

export type { FormEvent, FormState } from "./form-state";
export { createFormState, getFormIssues, reduceFormState } from "./form-state";
export type { FormInstance, FormNode } from "./form-nodes";
export { getFormNodes } from "./form-nodes";
