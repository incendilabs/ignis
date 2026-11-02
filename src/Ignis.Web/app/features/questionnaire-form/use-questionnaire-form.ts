/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { useMemo, useReducer } from "react";

import {
  createFormState,
  getFormIssues,
  getFormNodes,
  type Questionnaire,
  reduceFormState,
} from "#app/lib/fhir/questionnaire";

export function useQuestionnaireForm(questionnaire: Pick<Questionnaire, "url" | "version" | "item">) {
  const [state, dispatch] = useReducer(reduceFormState, questionnaire, createFormState);
  return useMemo(() => {
    const issues = getFormIssues(questionnaire, state);
    const nodes = getFormNodes(questionnaire, state.response, issues);
    return { response: state.response, showIssues: state.showIssues, issues, nodes, dispatch };
  }, [questionnaire, state]);
}
