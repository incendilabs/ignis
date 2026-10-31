/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { QuestionnaireItem } from "./model";
import type { ResponsePath } from "./response";

/** The path to the first instance of `linkId`, for questionnaires where linkIds are unique. */
export function pathOf(items: QuestionnaireItem[], linkId: string, parentPath: ResponsePath = []): ResponsePath {
  for (const item of items) {
    const path = [...parentPath, { linkId: item.linkId, index: 0 }];
    if (item.linkId === linkId) return path;
    const nested = pathOf(item.item ?? [], linkId, path);
    if (nested.length > 0) return nested;
  }
  return [];
}
