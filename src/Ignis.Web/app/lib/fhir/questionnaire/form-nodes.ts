/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { createEnabledItemCheck } from "./enable-when";
import type { Questionnaire, QuestionnaireItem } from "./model";
import {
  getAnswersAt,
  getInstancePaths,
  isRepeatingGroup,
  pathToKey,
  type QuestionnaireResponse,
  type QuestionnaireResponseAnswer,
  type ResponsePath,
} from "./response";
import type { ResponseIssue } from "./validate";

/** An item as a form renders it. */
export interface FormNode {
  item: QuestionnaireItem;
  parentPath: ResponsePath;
  repeats: boolean;
  canRemove: boolean;
  instances: FormInstance[];
}

/** The item as it occurs in the response; only a repeating group has more than one. */
export interface FormInstance {
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
  const isItemEnabled = createEnabledItemCheck(questionnaire, response);
  const issuesByKey = new Map(issues.map((issue) => [pathToKey(issue.path), issue]));
  const toNodes = (items: QuestionnaireItem[], parentPath: ResponsePath): FormNode[] =>
    items
      .filter((item) => isItemEnabled(parentPath, item.linkId))
      .map((item) => {
        const paths = getInstancePaths(response, parentPath, item);
        const repeats = isRepeatingGroup(item);
        return {
          item,
          parentPath,
          repeats,
          canRemove: repeats && (paths.length > 1 || item.required !== true),
          instances: paths.map((path) => ({
            path,
            answer: getAnswersAt(response, path).at(0),
            issue: issuesByKey.get(pathToKey(path)),
            children: toNodes(item.item ?? [], path),
          })),
        };
      });
  return toNodes(questionnaire.item ?? [], []);
}
