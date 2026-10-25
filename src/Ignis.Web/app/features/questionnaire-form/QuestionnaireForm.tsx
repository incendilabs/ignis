/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { m } from "#app/i18n/paraglide/messages";
import {
  getAnswers,
  getEnabledItems,
  type QuestionnaireItem,
  type QuestionnaireResponse,
  type QuestionnaireResponseAnswer,
  type ResponseIssue,
} from "#app/lib/fhir/questionnaire";

import type { AnswerChoicesState, QuestionnaireFormComponents } from "./components";

interface FormContext {
  response: QuestionnaireResponse;
  onAnswer: (linkId: string, answer: QuestionnaireResponseAnswer | undefined) => void;
  getChoices: (item: QuestionnaireItem) => AnswerChoicesState;
  enabledItems: Set<string>;
  issues: ResponseIssue[];
  components: QuestionnaireFormComponents;
}

/** Disabled items are hidden. */
export function QuestionnaireForm({
  items,
  ...context
}: Omit<FormContext, "enabledItems"> & { items: QuestionnaireItem[]; }) {
  const enabledItems = getEnabledItems({ item: items }, context.response);
  return <FormItems items={items} context={{ ...context, enabledItems }} />;
}

function FormItems({ items, context }: { items: QuestionnaireItem[]; context: FormContext; }) {
  return items
    .filter((item) => context.enabledItems.has(item.linkId))
    .map((item) => <FormItem key={item.linkId} item={item} context={context} />);
}

function FormItem({ item, context }: { item: QuestionnaireItem; context: FormContext; }) {
  const { Group, Display, Unsupported, fields } = context.components;
  const children = item.item ?? [];
  if (item.type === "display") return <Display item={item} />;
  if (item.type === "group") {
    return (
      <Group item={item}>
        <FormItems items={children} context={context} />
      </Group>
    );
  }

  const Field = fields[item.type];
  const issue = context.issues.find((candidate) => candidate.linkId === item.linkId);
  return (
    <>
      {Field === undefined ? (
        <Unsupported item={item} />
      ) : (
        <Field
          item={item}
          answer={getAnswers(context.response, item.linkId)[0]}
          onAnswer={(answer) => {
            context.onAnswer(item.linkId, answer);
          }}
          choices={context.getChoices(item)}
          error={issue === undefined ? undefined : m.questionnaire_form_required()}
          disabled={item.readOnly === true}
        />
      )}
      {children.length > 0 ? <FormItems items={children} context={context} /> : null}
    </>
  );
}
