/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { m } from "#app/i18n/paraglide/messages";
import type { FormNode, QuestionnaireItem, FormEvent } from "#app/lib/fhir/questionnaire";

import type { AnswerChoicesState, QuestionnaireFormComponents } from "./components";

interface FormContext {
  dispatch: (event: FormEvent) => void;
  getChoices: (item: QuestionnaireItem) => AnswerChoicesState;
  components: QuestionnaireFormComponents;
}

export function QuestionnaireForm({ nodes, ...context }: FormContext & { nodes: FormNode[]; }) {
  return <FormNodes nodes={nodes} context={context} />;
}

function FormNodes({ nodes, context }: { nodes: FormNode[]; context: FormContext; }) {
  return nodes.map((node) => <FormItem key={node.item.linkId} node={node} context={context} />);
}

function FormItem({ node, context }: { node: FormNode; context: FormContext; }) {
  const { item, path, children } = node;
  const { Group, Display, Unsupported, fields } = context.components;
  if (item.type === "display") return <Display item={item} />;
  if (item.type === "group") {
    return (
      <Group item={item}>
        <FormNodes nodes={children} context={context} />
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
          answer={node.answer}
          onAnswer={(answer) => {
            context.dispatch({ type: "setAnswer", path, answer });
          }}
          choices={context.getChoices(item)}
          error={node.issue === undefined ? undefined : m.questionnaire_form_required()}
          disabled={item.readOnly === true}
        />
      )}
      {children.length > 0 ? <FormNodes nodes={children} context={context} /> : null}
    </>
  );
}
