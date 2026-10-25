/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Text } from "@eventuras/ratio-ui/core/Text";
import { Fieldset, NumberField, RadioGroup, Select, TextField } from "@eventuras/ratio-ui/forms";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";

import { m } from "#app/i18n/paraglide/messages";
import { type AnswerChoice, findAnswerChoiceIndex, type QuestionnaireItem } from "#app/lib/fhir/questionnaire";

import type { AnswerChoicesState, QuestionFieldProps, QuestionnaireFormComponents } from "../components";

const MAX_RADIO_CHOICES = 5;

const getLabel = (item: QuestionnaireItem) => item.text ?? item.linkId;

function createTextField(type: "text" | "url" | "date", key: "valueString" | "valueUri" | "valueDate", multiline = false) {
  return function Field({ item, answer, onAnswer, error, disabled }: QuestionFieldProps) {
    return (
      <TextField
        name={item.linkId}
        type={type}
        label={getLabel(item)}
        multiline={multiline}
        value={answer?.[key] ?? ""}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          onAnswer({ [key]: event.target.value });
        }}
        errors={error === undefined ? undefined : { [item.linkId]: { message: error } }}
        disabled={disabled}
      />
    );
  };
}

function createNumberField(key: "valueInteger" | "valueDecimal") {
  return function Field({ item, answer, onAnswer, error, disabled }: QuestionFieldProps) {
    return (
      <NumberField
        label={getLabel(item)}
        value={answer?.[key] ?? Number.NaN}
        onChange={(value) => {
          onAnswer(Number.isNaN(value) ? undefined : { [key]: value });
        }}
        formatOptions={key === "valueInteger" ? { maximumFractionDigits: 0 } : undefined}
        errorMessage={error}
        isInvalid={error !== undefined}
        isDisabled={disabled}
      />
    );
  };
}

function BooleanField({ item, answer, onAnswer, error, disabled }: QuestionFieldProps) {
  const value = answer?.valueBoolean;
  return (
    <RadioGroup
      name={item.linkId}
      label={getLabel(item)}
      value={value === undefined ? "" : String(value)}
      onChange={(selected) => {
        onAnswer({ valueBoolean: selected === "true" });
      }}
      options={[
        { value: "true", label: m.questionnaire_form_yes() },
        { value: "false", label: m.questionnaire_form_no() },
      ]}
      error={error}
      disabled={disabled}
    />
  );
}

function ChoiceField(props: QuestionFieldProps) {
  const { item, choices } = props;
  if (choices.kind === "ready" && choices.choices.length > 0) {
    return <ChoiceInput {...props} choices={choices.choices} />;
  }
  return (
    <Stack direction="vertical" gap="xs">
      <Text>{getLabel(item)}</Text>
      <Text size="sm" variant="subtle">{getChoicesProblem(item, choices)}</Text>
    </Stack>
  );
}

function getChoicesProblem(item: QuestionnaireItem, choices: AnswerChoicesState): string {
  switch (choices.kind) {
    case "pending":
      return m.questionnaire_form_choices_loading();
    case "error":
      return m.questionnaire_form_choices_error({ valueSet: item.answerValueSet ?? "" });
    case "ready":
      return m.questionnaire_form_choices_none();
  }
}

function ChoiceInput({
  item,
  answer,
  onAnswer,
  choices,
  error,
  disabled,
}: Omit<QuestionFieldProps, "choices"> & { choices: AnswerChoice[]; }) {
  const selected = findAnswerChoiceIndex(choices, answer);
  const options = choices.map((choice, index) => ({ value: String(index), label: choice.label }));
  const select = (key: string | null) => {
    const choice = key === null ? undefined : choices[Number(key)];
    onAnswer(choice?.answer);
  };

  if (choices.length <= MAX_RADIO_CHOICES) {
    return (
      <RadioGroup
        name={item.linkId}
        label={getLabel(item)}
        value={selected < 0 ? "" : String(selected)}
        onChange={select}
        options={options}
        error={error}
        disabled={disabled}
      />
    );
  }
  return (
    <Stack direction="vertical" gap="xs">
      <Select
        label={getLabel(item)}
        options={options}
        selectedKey={selected < 0 ? null : String(selected)}
        onSelectionChange={select}
        isInvalid={error !== undefined}
        isDisabled={disabled}
      />
      {error === undefined ? null : <Text size="sm" color="error">{error}</Text>}
    </Stack>
  );
}

export const ratioUiComponents: QuestionnaireFormComponents = {
  fields: {
    string: createTextField("text", "valueString"),
    text: createTextField("text", "valueString", true),
    url: createTextField("url", "valueUri"),
    date: createTextField("date", "valueDate"),
    integer: createNumberField("valueInteger"),
    decimal: createNumberField("valueDecimal"),
    boolean: BooleanField,
    choice: ChoiceField,
  },
  Group: ({ item, children }) => (
    <Fieldset label={getLabel(item)}>
      <Stack direction="vertical" gap="md">{children}</Stack>
    </Fieldset>
  ),
  Display: ({ item }) => <Text>{getLabel(item)}</Text>,
  Unsupported: ({ item }) => (
    <Text variant="subtle">{m.questionnaire_form_unsupported({ label: getLabel(item), type: item.type })}</Text>
  ),
};
