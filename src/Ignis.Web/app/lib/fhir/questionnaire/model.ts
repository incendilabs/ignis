/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Canonical, Coding, Resource, Uri } from "../model";

/**
 * FHIR `Questionnaire.item.type` codes. A reference union — the parsed model
 * keeps `type` as a plain string so unknown or newer codes survive.
 *
 * References:
 * - R4: https://hl7.org/fhir/R4/valueset-item-type.html
 * - R4B: https://hl7.org/fhir/R4B/valueset-item-type.html
 * - R5: https://hl7.org/fhir/R5/valueset-item-type.html
 * - R6: https://hl7.org/fhir/R6/valueset-item-type.html
 */
export type QuestionnaireItemType =
  | "group"
  | "display"
  | "boolean"
  | "decimal"
  | "integer"
  | "date"
  | "dateTime"
  | "time"
  | "string"
  | "text"
  | "url"
  | "choice"
  | "open-choice"
  | "attachment"
  | "reference"
  | "quantity";

/** One selectable answer for a `choice` / `open-choice` item. */
export interface QuestionnaireItemAnswerOption {
  valueCoding?: Coding;
  valueString?: string;
  valueInteger?: number;
  valueDate?: string;
  valueTime?: string;
  valueBoolean?: boolean;
  initialSelected?: boolean;
}

/** A conditional-display rule (`item.enableWhen`); `answer[x]` kept open. */
export interface QuestionnaireEnableWhen {
  question: string;
  operator: string;
  [key: string]: unknown;
}

/** A single Questionnaire item; `item` nests to form the tree. */
export interface QuestionnaireItem {
  linkId: string;
  type: string;
  text?: string;
  definition?: Uri;
  required?: boolean;
  repeats?: boolean;
  readOnly?: boolean;
  answerValueSet?: Canonical;
  answerOption?: QuestionnaireItemAnswerOption[];
  enableWhen?: QuestionnaireEnableWhen[];
  item?: QuestionnaireItem[];
}

/**
 * FHIR Questionnaire — the fields the catalog and form filler need.
 *
 * References:
 * - R4: https://hl7.org/fhir/R4/questionnaire.html
 * - R4B: https://hl7.org/fhir/R4B/questionnaire.html
 * - R5: https://hl7.org/fhir/R5/questionnaire.html
 * - R6: https://hl7.org/fhir/R6/questionnaire.html
 */
export interface Questionnaire extends Resource<"Questionnaire"> {
  url?: Canonical;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  item?: QuestionnaireItem[];
}
