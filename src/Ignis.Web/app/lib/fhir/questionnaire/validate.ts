/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { getEnabledItems } from "./enable-when";
import type { Questionnaire, QuestionnaireItem } from "./model";
import { getAnswers, type QuestionnaireResponse } from "./response";

/** A problem with a response, located by the item it concerns. */
export interface ResponseIssue {
  linkId: string;
  code: "required";
}

/** Only `required` so far: a question needs an answer, a group an answered question below it. Disabled items are skipped. */
export function validateResponse(
  questionnaire: Pick<Questionnaire, "item">,
  response: QuestionnaireResponse,
): ResponseIssue[] {
  const enabledItems = getEnabledItems(questionnaire, response);
  const isAnswered = (item: QuestionnaireItem): boolean =>
    enabledItems.has(item.linkId) && getAnswers(response, item.linkId).length > 0;
  const hasAnsweredQuestion = (items: QuestionnaireItem[]): boolean =>
    items.some((item) => isAnswered(item) || hasAnsweredQuestion(item.item ?? []));

  const issues: ResponseIssue[] = [];
  const visit = (items: QuestionnaireItem[]) => {
    for (const item of items) {
      if (!enabledItems.has(item.linkId)) continue;
      if (item.required === true && item.type !== "display") {
        const satisfied = item.type === "group" ? hasAnsweredQuestion(item.item ?? []) : isAnswered(item);
        if (!satisfied) issues.push({ linkId: item.linkId, code: "required" });
      }
      visit(item.item ?? []);
    }
  };
  visit(questionnaire.item ?? []);
  return issues;
}
