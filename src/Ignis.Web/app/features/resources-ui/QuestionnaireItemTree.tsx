/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Card } from "@eventuras/ratio-ui/core/Card";
import { Chip } from "@eventuras/ratio-ui/core/Chip";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { Tree, type TreeNode } from "@eventuras/ratio-ui/tree";
import { useMemo } from "react";

import { m } from "#app/i18n/paraglide/messages";
import type { Resource } from "#app/lib/fhir/model";
import {
  type AnswerChoice,
  parseQuestionnaireItems,
  type QuestionnaireItem,
  resolveAnswerChoices,
} from "#app/lib/fhir/questionnaire";

/** A tree node: either a Questionnaire item or one of its answer options. */
type QuestionnaireNode = ItemNode | OptionNode;
interface ItemNode extends TreeNode {
  kind: "item";
  item: QuestionnaireItem;
  children?: QuestionnaireNode[];
}
interface OptionNode extends TreeNode {
  kind: "option";
  choice: AnswerChoice;
}

export function QuestionnaireItemTree({ resource }: { resource: Resource; }) {
  const { nodes, expandedKeys } = useMemo(() => build(resource), [resource]);

  if (nodes.length === 0) {
    return (
      <Panel>
        <Text>{m.resources_questionnaire_empty()}</Text>
      </Panel>
    );
  }

  return (
    <Card>
      <Tree
        aria-label={m.resources_instance_tab_form()}
        items={nodes}
        defaultExpandedKeys={expandedKeys}
        getLabel={nodeLabel}
        renderNode={(node) => {
          if (node.kind === "option") return <OptionRow choice={node.choice} />;
          return node.item.type === "group" ? (
            <GroupRow item={node.item} />
          ) : (
            <QuestionRow item={node.item} />
          );
        }}
      />
    </Card>
  );
}

function build(resource: Resource): { nodes: QuestionnaireNode[]; expandedKeys: string[]; } {
  const expandedKeys: string[] = [];
  const toNode = (item: QuestionnaireItem, id: string): ItemNode => {
    const itemChildren = (item.item ?? []).map((child, index) =>
      toNode(child, `${id}.${String(index)}`),
    );
    if (itemChildren.length > 0) {
      expandedKeys.push(id);
      return { kind: "item", id, item, children: itemChildren };
    }
    const choices = resolveAnswerChoices(resource, item);
    if (choices && choices.length > 0) {
      expandedKeys.push(id);
      const children: OptionNode[] = choices.map((choice, index) => ({
        kind: "option",
        id: `${id}.opt.${String(index)}`,
        choice,
      }));
      return { kind: "item", id, item, children };
    }
    return { kind: "item", id, item };
  };

  const nodes = parseQuestionnaireItems(resource).map((item, index) => toNode(item, String(index)));
  return { nodes, expandedKeys };
}

function nodeLabel(node: QuestionnaireNode): string {
  return node.kind === "option" ? node.choice.label : (node.item.text ?? node.item.linkId);
}

/** A group row: a serif heading with a subtle `group · N` count. */
function GroupRow({ item }: { item: QuestionnaireItem; }) {
  const count = item.item?.length ?? 0;
  return (
    <Stack direction="horizontal" gap="sm" align="end" wrap>
      <Heading as="h4">{item.text ?? item.linkId}</Heading>
      <Text as="span" variant="subtle">
        {`${item.type} · ${String(count)}`}
      </Text>
    </Stack>
  );
}

/** A question row: the text, then a subtle line with type / flags / answer source. */
function QuestionRow({ item }: { item: QuestionnaireItem; }) {
  const hint = answerHint(item);
  return (
    <Stack direction="vertical" gap="xs">
      <Text size="xl">{item.text ?? item.linkId}</Text>
      <Stack direction="horizontal" gap="sm" align="center" wrap>
        {item.type ? (
          <Text as="span" variant="subtle">
            {item.type}
          </Text>
        ) : null}
        {item.required ? <Chip>{m.resources_questionnaire_required()}</Chip> : null}
        {item.repeats ? (
          <Text as="span" variant="subtle">
            {m.resources_questionnaire_repeats()}
          </Text>
        ) : null}
        {hint ? (
          <Text as="span" variant="subtle">
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}

/** One answer option row: its code as a badge, then the display text. */
function OptionRow({ choice }: { choice: AnswerChoice; }) {
  return (
    <Stack direction="horizontal" gap="sm" align="center" wrap>
      {choice.code ? <Chip>{choice.code}</Chip> : null}
      <Text as="span" variant="subtle">
        {choice.display ?? choice.code ?? choice.label}
      </Text>
    </Stack>
  );
}

/** Where a leaf item's answers come from: a bound ValueSet or inline options. */
function answerHint(item: QuestionnaireItem): string | undefined {
  if (item.answerValueSet) {
    return m.resources_questionnaire_valueset({ name: canonicalTail(item.answerValueSet) });
  }
  if (item.answerOption && item.answerOption.length > 0) {
    return m.resources_questionnaire_options({ count: item.answerOption.length });
  }
  return undefined;
}

/** The human-facing tail of a canonical URL, dropping any `|version` suffix. */
function canonicalTail(url: string): string {
  const [base] = url.split("|");
  const tail = base.split("/").pop();
  return tail === undefined || tail === "" ? base : tail;
}
