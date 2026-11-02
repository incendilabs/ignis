/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { useId } from "react";

import { m } from "#app/i18n/paraglide/messages";
import type { FormEvent, FormInstance, FormNode, QuestionnaireItem } from "#app/lib/fhir/questionnaire";

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
  const { item, instances } = node;
  const { Group, Repeat, Display } = context.components;
  if (item.type === "display") return <Display item={item} />;
  if (item.type !== "group") {
    return instances.map((instance, index) => (
      <QuestionItem key={index} item={item} instance={instance} context={context} />
    ));
  }

  const groups = instances.map((instance, index) => {
    const remove = () => {
      context.dispatch({ type: "removeItem", path: instance.path });
    };
    return (
      <Group key={index} item={item} onRemove={node.canRemove ? remove : undefined}>
        <FormNodes nodes={instance.children} context={context} />
      </Group>
    );
  });
  if (!node.repeats) return groups;

  const add = () => {
    context.dispatch({ type: "addItem", parentPath: node.parentPath, item });
  };
  return <Repeat item={item} onAdd={add}>{groups}</Repeat>;
}

function QuestionItem({ item, instance, context }: { item: QuestionnaireItem; instance: FormInstance; context: FormContext; }) {
  const id = useId();
  const { fields, Unsupported } = context.components;
  const Field = fields[item.type];
  return (
    <>
      {Field === undefined ? (
        <Unsupported item={item} />
      ) : (
        <Field
          id={id}
          item={item}
          answer={instance.answer}
          onAnswer={(answer) => {
            context.dispatch({ type: "setAnswer", path: instance.path, answer });
          }}
          choices={context.getChoices(item)}
          error={instance.issue === undefined ? undefined : m.questionnaire_form_required()}
          disabled={item.readOnly === true}
        />
      )}
      {instance.children.length > 0 ? <FormNodes nodes={instance.children} context={context} /> : null}
    </>
  );
}
