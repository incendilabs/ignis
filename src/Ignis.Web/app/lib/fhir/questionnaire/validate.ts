/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { getEnabledLinkIds } from "./enable-when";
import type { Questionnaire, QuestionnaireItem } from "./model";
import { getAnswersAt, getInstancePaths, type QuestionnaireResponse, type ResponsePath } from "./response";

/** A problem with the item at `path`. */
export interface ResponseIssue {
  path: ResponsePath;
  linkId: string;
  code: "required";
}

/**
 * Only `required` so far: a question needs an answer, a group an answered question below it, and a
 * repeating group at least one instance. Disabled items are skipped; every instance is checked.
 */
export function validateResponse(
  questionnaire: Pick<Questionnaire, "item">,
  response: QuestionnaireResponse,
): ResponseIssue[] {
  const enabledItems = getEnabledLinkIds(questionnaire, response);
  const isAnswered = (item: QuestionnaireItem, path: ResponsePath): boolean =>
    enabledItems.has(item.linkId) && item.type !== "group" && getAnswersAt(response, path).length > 0;
  const hasAnsweredQuestion = (items: QuestionnaireItem[], parentPath: ResponsePath): boolean =>
    items.some((item) =>
      getInstancePaths(response, parentPath, item).some((path) =>
        isAnswered(item, path) || hasAnsweredQuestion(item.item ?? [], path)
      )
    );

  const issues: ResponseIssue[] = [];
  const visit = (items: QuestionnaireItem[], parentPath: ResponsePath) => {
    for (const item of items) {
      if (!enabledItems.has(item.linkId)) continue;
      const paths = getInstancePaths(response, parentPath, item);
      const isRequired = item.required === true && item.type !== "display";
      if (isRequired && paths.length === 0) {
        issues.push({ path: [...parentPath, { linkId: item.linkId, index: 0 }], linkId: item.linkId, code: "required" });
      }
      for (const path of paths) {
        if (isRequired) {
          const satisfied = item.type === "group" ? hasAnsweredQuestion(item.item ?? [], path) : isAnswered(item, path);
          if (!satisfied) issues.push({ path, linkId: item.linkId, code: "required" });
        }
        visit(item.item ?? [], path);
      }
    }
  };
  visit(questionnaire.item ?? [], []);
  return issues;
}
