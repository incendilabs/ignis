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
import { formatPrimitive } from "#app/lib/fhir/format";
import type { Extension, Resource } from "#app/lib/fhir/model";
import { extensionValue, extensionValueType } from "#app/lib/fhir/model";
import {
  type AnswerChoice,
  parseQuestionnaireExtensions,
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
  const extensions = useMemo(() => parseQuestionnaireExtensions(resource), [resource]);

  if (nodes.length === 0 && extensions.length === 0) {
    return (
      <Panel>
        <Text>{m.resources_questionnaire_empty()}</Text>
      </Panel>
    );
  }

  return (
    <Stack direction="vertical" gap="md">
      {extensions.length > 0 ? <DefinitionExtensions extensions={extensions} /> : null}
      {nodes.length > 0 ? (
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
      ) : null}
    </Stack>
  );
}

/** Extensions carried by the Questionnaire itself — where a profile marks the definition. */
function DefinitionExtensions({ extensions }: { extensions: Extension[]; }) {
  return (
    <Card>
      <Stack direction="vertical" gap="sm">
        <Heading as="h4">{m.resources_questionnaire_extensions()}</Heading>
        {extensions.map((extension, index) => (
          <ExtensionRow key={`${extension.url}.${String(index)}`} extension={extension} />
        ))}
      </Stack>
    </Card>
  );
}

/** One extension: its defining url, then the value[x] it carries. */
function ExtensionRow({ extension }: { extension: Extension; }) {
  const summary = extensionSummary(extension);
  return (
    <Stack direction="vertical" gap="xs">
      <Text as="span" size="sm">
        {extension.url}
      </Text>
      <Stack direction="horizontal" gap="sm" align="center" wrap>
        {summary.type ? <Chip>{summary.type}</Chip> : null}
        {summary.text ? (
          <Text as="span" variant="subtle">
            {summary.text}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}

/**
 * How to label an extension's payload: the datatype, plus the value itself when
 * it is a primitive. Complex values are not flattened — showing their type is
 * honest, inventing a one-line rendering of them is not.
 */
function extensionSummary(extension: Extension): { type: string; text: string; } {
  const nested = extension.extension;
  if (nested !== undefined && nested.length > 0) {
    return {
      type: "extension",
      text: m.resources_questionnaire_extensions_nested({ count: nested.length }),
    };
  }

  const value = extensionValue(extension);
  if (value === undefined) return { type: "", text: "" };

  const type = extensionValueType(value.field);
  const primitive =
    typeof value.value === "string" ||
    typeof value.value === "number" ||
    typeof value.value === "boolean"
      ? formatPrimitive(value.value)
      : null;

  return { type, text: primitive ?? "" };
}

/** Extensions on a tree row, compact: one wrapped line of url-tail chips. */
function ItemExtensions({ extensions }: { extensions: Extension[]; }) {
  return (
    <Stack direction="horizontal" gap="sm" align="center" wrap>
      {extensions.map((extension, index) => (
        <ExtensionChip key={`${extension.url}.${String(index)}`} extension={extension} />
      ))}
    </Stack>
  );
}

/** One extension as its url tail in a chip, then the primitive value or datatype. */
function ExtensionChip({ extension }: { extension: Extension; }) {
  const summary = extensionSummary(extension);
  const detail = summary.text !== "" ? summary.text : summary.type;
  return (
    <Stack direction="horizontal" gap="xs" align="center">
      <Chip>{canonicalTail(extension.url)}</Chip>
      {detail ? (
        <Text as="span" variant="subtle">
          {detail}
        </Text>
      ) : null}
    </Stack>
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
    <Stack direction="vertical" gap="xs">
      <Stack direction="horizontal" gap="sm" align="end" wrap>
        <Heading as="h4">{item.text ?? item.linkId}</Heading>
        <Text as="span" variant="subtle">
          {`${item.type} · ${String(count)}`}
        </Text>
      </Stack>
      {item.extension ? <ItemExtensions extensions={item.extension} /> : null}
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
      {item.extension ? <ItemExtensions extensions={item.extension} /> : null}
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
      {choice.extension?.map((extension, index) => (
        <ExtensionChip key={`${extension.url}.${String(index)}`} extension={extension} />
      ))}
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
