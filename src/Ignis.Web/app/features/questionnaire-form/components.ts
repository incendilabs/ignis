/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { ComponentType, ReactNode } from "react";

import type {
  AnswerChoice,
  QuestionnaireItem,
  QuestionnaireResponseAnswer,
} from "#app/lib/fhir/questionnaire";

export type AnswerChoicesState =
  | { kind: "pending"; }
  | { kind: "error"; }
  | { kind: "ready"; choices: AnswerChoice[]; };

export interface QuestionFieldProps {
  item: QuestionnaireItem;
  answer: QuestionnaireResponseAnswer | undefined;
  onAnswer: (answer: QuestionnaireResponseAnswer | undefined) => void;
  choices: AnswerChoicesState;
  error: string | undefined;
  disabled: boolean;
}

export interface QuestionnaireFormComponents {
  fields: Partial<Record<string, ComponentType<QuestionFieldProps>>>;
  Group: ComponentType<{ item: QuestionnaireItem; children: ReactNode; }>;
  Display: ComponentType<{ item: QuestionnaireItem; }>;
  Unsupported: ComponentType<{ item: QuestionnaireItem; }>;
}
