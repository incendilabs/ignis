/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { getEnabledLinkIds } from "./enable-when";
import type { Questionnaire, QuestionnaireItem } from "./model";
import {
  getAnswersAt,
  pathToKey,
  type QuestionnaireResponse,
  type QuestionnaireResponseAnswer,
  type ResponsePath,
} from "./response";
import type { ResponseIssue } from "./validate";

/** An item as a form renders it. */
export interface FormNode {
  item: QuestionnaireItem;
  path: ResponsePath;
  answer: QuestionnaireResponseAnswer | undefined;
  issue: ResponseIssue | undefined;
  children: FormNode[];
}

export function getFormNodes(
  questionnaire: Pick<Questionnaire, "item">,
  response: QuestionnaireResponse,
  issues: ResponseIssue[],
): FormNode[] {
  const enabledItems = getEnabledLinkIds(questionnaire, response);
  const issuesByKey = new Map(issues.map((issue) => [pathToKey(issue.path), issue]));
  const toNodes = (items: QuestionnaireItem[], parentPath: ResponsePath): FormNode[] =>
    items
      .filter((item) => enabledItems.has(item.linkId))
      .map((item) => {
        const path = [...parentPath, { linkId: item.linkId, index: 0 }];
        return {
          item,
          path,
          answer: getAnswersAt(response, path).at(0),
          issue: issuesByKey.get(pathToKey(path)),
          children: toNodes(item.item ?? [], path),
        };
      });
  return toNodes(questionnaire.item ?? [], []);
}
