/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { m } from "#app/i18n/paraglide/messages";
import {
  getAnswersAt,
  getEnabledItems,
  pathToKey,
  type QuestionnaireItem,
  type QuestionnaireResponse,
  type QuestionnaireResponseAnswer,
  type ResponseIssue,
  type ResponsePath,
} from "#app/lib/fhir/questionnaire";

import type { AnswerChoicesState, QuestionnaireFormComponents } from "./components";

interface FormContext {
  response: QuestionnaireResponse;
  onAnswer: (path: ResponsePath, answer: QuestionnaireResponseAnswer | undefined) => void;
  getChoices: (item: QuestionnaireItem) => AnswerChoicesState;
  enabledItems: Set<string>;
  issuePaths: Set<string>;
  components: QuestionnaireFormComponents;
}

/** Disabled items are hidden. Every item is rendered once; `repeats` is not supported yet. */
export function QuestionnaireForm({
  items,
  issues,
  ...context
}: Omit<FormContext, "enabledItems" | "issuePaths"> & { items: QuestionnaireItem[]; issues: ResponseIssue[]; }) {
  const enabledItems = getEnabledItems({ item: items }, context.response);
  const issuePaths = new Set(issues.map((issue) => pathToKey(issue.path)));
  return <FormItems items={items} parentPath={[]} context={{ ...context, enabledItems, issuePaths }} />;
}

function FormItems({
  items,
  parentPath,
  context,
}: {
  items: QuestionnaireItem[];
  parentPath: ResponsePath;
  context: FormContext;
}) {
  return items
    .filter((item) => context.enabledItems.has(item.linkId))
    .map((item) => <FormItem key={item.linkId} item={item} parentPath={parentPath} context={context} />);
}

function FormItem({
  item,
  parentPath,
  context,
}: {
  item: QuestionnaireItem;
  parentPath: ResponsePath;
  context: FormContext;
}) {
  const { Group, Display, Unsupported, fields } = context.components;
  const children = item.item ?? [];
  const path = [...parentPath, { linkId: item.linkId, index: 0 }];
  if (item.type === "display") return <Display item={item} />;
  if (item.type === "group") {
    return (
      <Group item={item}>
        <FormItems items={children} parentPath={path} context={context} />
      </Group>
    );
  }

  const Field = fields[item.type];
  return (
    <>
      {Field === undefined ? (
        <Unsupported item={item} />
      ) : (
        <Field
          item={item}
          answer={getAnswersAt(context.response, path)[0]}
          onAnswer={(answer) => {
            context.onAnswer(path, answer);
          }}
          choices={context.getChoices(item)}
          error={context.issuePaths.has(pathToKey(path)) ? m.questionnaire_form_required() : undefined}
          disabled={item.readOnly === true}
        />
      )}
      {children.length > 0 ? <FormItems items={children} parentPath={path} context={context} /> : null}
    </>
  );
}
