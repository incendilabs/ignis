/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

export type { AnswerChoice } from "./answers";
export {
  getExternalAnswerValueSets,
  findAnswerChoiceIndex,
  hasExternalAnswerValueSet,
  isSameAnswer,
  resolveAnswerChoices,
  valueSetToAnswerChoices,
} from "./answers";
export type {
  Questionnaire,
  QuestionnaireEnableWhen,
  QuestionnaireItem,
  QuestionnaireItemAnswerOption,
  QuestionnaireItemType,
} from "./model";
export { parseQuestionnaireExtensions, parseQuestionnaireItems } from "./parse";
export { getEnabledItems } from "./enable-when";
export type {
  PathSegment,
  QuestionnaireResponse,
  QuestionnaireResponseAnswer,
  QuestionnaireResponseItem,
  QuestionnaireResponseStatus,
  ResponsePath,
} from "./response";
export { createResponse, getAnswers, getAnswersAt, pathToKey, pruneEmptyItems, setAnswer } from "./response";
export type { ResponseIssue } from "./validate";
export { validateResponse } from "./validate";
