/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Button } from "@eventuras/ratio-ui/core/Button";
import { Card } from "@eventuras/ratio-ui/core/Card";
import { CodeBlock } from "@eventuras/ratio-ui/core/CodeBlock";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { useMemo, useState } from "react";

import type { AnswerChoicesState } from "#app/features/questionnaire-form/components";
import { QuestionnaireForm } from "#app/features/questionnaire-form/QuestionnaireForm";
import { ratioUiComponents } from "#app/features/questionnaire-form/ratio-ui/ratio-ui-components";
import { m } from "#app/i18n/paraglide/messages";
import { asString } from "#app/lib/fhir/guards";
import type { Resource } from "#app/lib/fhir/model";
import {
  createResponse,
  parseQuestionnaireItems,
  pruneEmptyItems,
  type QuestionnaireItem,
  resolveAnswerChoices,
  setAnswer,
  validateResponse,
} from "#app/lib/fhir/questionnaire";

import { useExpansions } from "./use-expansions";

export function QuestionnaireFiller({
  resource,
  showResponse = false,
}: {
  resource: Resource;
  showResponse?: boolean;
}) {
  const questionnaire = useMemo(
    () => ({
      url: asString(resource.url),
      version: asString(resource.version),
      item: parseQuestionnaireItems(resource),
    }),
    [resource],
  );
  const [response, setResponse] = useState(() => createResponse(questionnaire));
  const expansions = useExpansions(questionnaire.item);
  const [checked, setChecked] = useState(false);

  if (questionnaire.item.length === 0) {
    return (
      <Panel>
        <Text>{m.resources_questionnaire_empty()}</Text>
      </Panel>
    );
  }

  const issues = checked ? validateResponse(questionnaire, response) : [];
  const getChoices = (item: QuestionnaireItem): AnswerChoicesState => {
    const inline = resolveAnswerChoices(resource, item);
    if (inline !== null) return { kind: "ready", choices: inline };
    const expansion = item.answerValueSet === undefined ? undefined : expansions[item.answerValueSet];
    return expansion ?? { kind: "ready", choices: [] };
  };

  return (
    <Stack direction="vertical" gap="md">
      <Card>
        <Stack direction="vertical" gap="md">
          <QuestionnaireForm
            items={questionnaire.item}
            response={response}
            onAnswer={(path, answer) => {
              setResponse((current) => setAnswer(current, path, answer));
            }}
            getChoices={getChoices}
            issues={issues}
            components={ratioUiComponents}
          />
          <Stack direction="horizontal" gap="sm" align="center" wrap>
            <Button
              variant="primary"
              onPress={() => {
                setChecked(true);
              }}
            >
              {m.questionnaire_form_check()}
            </Button>
            {checked && issues.length === 0 ? <Text>{m.questionnaire_form_complete()}</Text> : null}
          </Stack>
        </Stack>
      </Card>
      {showResponse ? (
        <CodeBlock
          code={JSON.stringify(pruneEmptyItems(response), null, 2)}
          language="JSON"
          filename="QuestionnaireResponse.json"
        />
      ) : null}
    </Stack>
  );
}
