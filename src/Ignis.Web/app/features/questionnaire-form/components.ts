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
  /** Unique per rendered field, also across group instances; linkIds are not. */
  id: string;
  item: QuestionnaireItem;
  answer: QuestionnaireResponseAnswer | undefined;
  onAnswer: (answer: QuestionnaireResponseAnswer | undefined) => void;
  choices: AnswerChoicesState;
  error: string | undefined;
  disabled: boolean;
}

export interface GroupProps {
  item: QuestionnaireItem;
  /** Required on an instance of a repeating group that can be removed. */
  onRemove?: () => void;
  children: ReactNode;
}

/** Wraps the instances of a repeating group. */
export interface RepeatProps {
  item: QuestionnaireItem;
  onAdd: () => void;
  children: ReactNode;
}

export interface QuestionnaireFormComponents {
  fields: Partial<Record<string, ComponentType<QuestionFieldProps>>>;
  Group: ComponentType<GroupProps>;
  Repeat: ComponentType<RepeatProps>;
  Display: ComponentType<{ item: QuestionnaireItem; }>;
  Unsupported: ComponentType<{ item: QuestionnaireItem; }>;
}
