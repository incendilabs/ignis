/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { getEnabledItems } from "./enable-when";
import type { Questionnaire, QuestionnaireItem } from "./model";
import { getAnswersAt, type QuestionnaireResponse, type ResponsePath } from "./response";

/** A problem with the item at `path`. */
export interface ResponseIssue {
  path: ResponsePath;
  linkId: string;
  code: "required";
}

/**
 * Only `required` so far: a question needs an answer, a group an answered question below it.
 * Disabled items are skipped, and only the first instance of each item is checked.
 */
export function validateResponse(
  questionnaire: Pick<Questionnaire, "item">,
  response: QuestionnaireResponse,
): ResponseIssue[] {
  const enabledItems = getEnabledItems(questionnaire, response);
  const pathTo = (item: QuestionnaireItem, parentPath: ResponsePath): ResponsePath =>
    [...parentPath, { linkId: item.linkId, index: 0 }];
  const isAnswered = (item: QuestionnaireItem, path: ResponsePath): boolean =>
    enabledItems.has(item.linkId) && item.type !== "group" && getAnswersAt(response, path).length > 0;
  const hasAnsweredQuestion = (items: QuestionnaireItem[], parentPath: ResponsePath): boolean =>
    items.some((item) => {
      const path = pathTo(item, parentPath);
      return isAnswered(item, path) || hasAnsweredQuestion(item.item ?? [], path);
    });

  const issues: ResponseIssue[] = [];
  const visit = (items: QuestionnaireItem[], parentPath: ResponsePath) => {
    for (const item of items) {
      if (!enabledItems.has(item.linkId)) continue;
      const path = pathTo(item, parentPath);
      if (item.required === true && item.type !== "display") {
        const satisfied = item.type === "group" ? hasAnsweredQuestion(item.item ?? [], path) : isAnswered(item, path);
        if (!satisfied) issues.push({ path, linkId: item.linkId, code: "required" });
      }
      visit(item.item ?? [], path);
    }
  };
  visit(questionnaire.item ?? [], []);
  return issues;
}
