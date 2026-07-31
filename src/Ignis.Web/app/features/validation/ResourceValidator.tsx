/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Badge } from "@eventuras/ratio-ui/core/Badge";
import { Button } from "@eventuras/ratio-ui/core/Button";
import { CodeBlock, type CodeAnnotation } from "@eventuras/ratio-ui/core/CodeBlock";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Stepper, type Step, type StepStatus } from "@eventuras/ratio-ui/core/Stepper";
import { Table } from "@eventuras/ratio-ui/core/Table";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Select, type SelectOption, TextField } from "@eventuras/ratio-ui/forms";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { type ChangeEvent, useMemo, useState } from "react";
import { useFetcher } from "react-router";

import type { ProfileInfo } from "#app/features/admin/profiles.server";
import { m } from "#app/i18n/paraglide/messages";
import { asStringArray } from "#app/lib/fhir/guards";
import { formatResourceWithLines } from "#app/lib/fhir/format";
import { isResource, type Resource } from "#app/lib/fhir/model";
import { isValidFhirResourceTypeName } from "#app/lib/fhir/validation";

import type { ValidationIssue, ValidationResult } from "./validate.server";

/** Select key for "don't pin a profile"; the empty string is not a usable key. */
const NO_PROFILE = "none";

type StepNumber = 1 | 2 | 3;

type FhirResource = Resource & { resourceType: string; };

type ParsedInput =
  | { ok: true; resource: FhirResource; }
  | { ok: false; message: string; };

/**
 * Paste a resource, pick a profile for the type it turned out to be, read the
 * findings against the source. The resource type is what makes the profile step
 * useful, so it has to come after the content.
 */
export function ResourceValidator({ profiles }: { profiles: ProfileInfo[] | null; }) {
  const fetcher = useFetcher<ValidationResult>();
  const [step, setStep] = useState<StepNumber>(1);
  const [text, setText] = useState("");
  const [profile, setProfile] = useState("");

  const parsed = useMemo(() => parseInput(text), [text]);
  const resource = parsed?.ok === true ? parsed.resource : null;
  const options = useMemo(() => profileOptions(resource, profiles), [resource, profiles]);

  // Editing the resource can strip the chosen profile from the list; drop it
  // rather than validating against a canonical that no longer fits the type.
  const known = profile === ""
    || profiles === null
    || options.some((option) => option.value === profile);
  const selectedProfile = known ? profile : "";

  const result = fetcher.data;
  const isValidating = fetcher.state !== "idle";

  const validate = () => {
    const body = new FormData();
    body.append("resource", text);
    body.append("profile", selectedProfile);
    void fetcher.submit(body, { method: "post" });
    setStep(3);
  };

  return (
    <Stack direction="vertical" gap="lg">
      <Stepper steps={stepItems(step, isValidating ? undefined : result)} currentStep={step} />

      {step === 1 && (
        <ResourceStep
          text={text}
          parsed={parsed}
          resource={resource}
          onChange={setText}
          onNext={() => { setStep(2); }}
        />
      )}

      {step === 2 && resource !== null && (
        <ProfileStep
          resourceType={resource.resourceType}
          profiles={profiles}
          options={options}
          selected={selectedProfile}
          isValidating={isValidating}
          onSelect={setProfile}
          onBack={() => { setStep(1); }}
          onValidate={validate}
        />
      )}

      {step === 3 && resource !== null && (
        <ResultStep
          resource={resource}
          result={result}
          isValidating={isValidating}
          onBack={() => { setStep(2); }}
        />
      )}
    </Stack>
  );
}

/** Step 1 — the resource itself, parsed as you type so the type is known up front. */
function ResourceStep({
  text,
  parsed,
  resource,
  onChange,
  onNext,
}: {
  text: string;
  parsed: ParsedInput | null;
  resource: FhirResource | null;
  onChange: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <Stack direction="vertical" gap="md">
      <TextField
        multiline
        rows={16}
        name="resource"
        label={m.validation_resource_label()}
        value={text}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { onChange(event.target.value); }}
        spellCheck={false}
      />

      {parsed !== null && !parsed.ok && (
        <Panel variant="alert" status="error">
          <Text>{parsed.message}</Text>
        </Panel>
      )}

      {resource !== null && (
        <Stack direction="horizontal" gap="sm" align="center">
          <Text>{m.validation_detected_type()}</Text>
          <Badge status="info">{resource.resourceType}</Badge>
        </Stack>
      )}

      <Stack direction="horizontal" gap="sm">
        <Button variant="primary" isDisabled={resource === null} onPress={onNext}>
          {m.validation_next()}
        </Button>
      </Stack>
    </Stack>
  );
}

/** Step 2 — the profiles that can apply to the type detected in step 1. */
function ProfileStep({
  resourceType,
  profiles,
  options,
  selected,
  isValidating,
  onSelect,
  onBack,
  onValidate,
}: {
  resourceType: string;
  profiles: ProfileInfo[] | null;
  options: SelectOption[];
  selected: string;
  isValidating: boolean;
  onSelect: (value: string) => void;
  onBack: () => void;
  onValidate: () => void;
}) {
  const hasLoadedProfiles = (profiles ?? []).some(
    (candidate) => candidate.type === resourceType,
  );

  return (
    <Stack direction="vertical" gap="md">
      {profiles === null ? (
        <>
          <Panel variant="notice" status="warning">
            <Text>{m.validation_profiles_unavailable()}</Text>
          </Panel>
          <TextField
            name="profile"
            type="url"
            label={m.validation_profile_label()}
            placeholder="https://…/StructureDefinition/…"
            value={selected}
            onChange={(event: ChangeEvent<HTMLInputElement>) => { onSelect(event.target.value); }}
          />
        </>
      ) : (
        <>
          <Select
            label={m.validation_profile_select_label()}
            options={options}
            selectedKey={selected === "" ? NO_PROFILE : selected}
            onSelectionChange={(value) => {
              onSelect(value === null || value === NO_PROFILE ? "" : value);
            }}
          />
          {!hasLoadedProfiles && (
            <Panel variant="notice" status="info">
              <Text>{m.validation_no_profiles_for_type({ type: resourceType })}</Text>
            </Panel>
          )}
        </>
      )}

      <Stack direction="horizontal" gap="sm">
        <Button variant="secondary" onPress={onBack}>{m.validation_back()}</Button>
        <Button variant="primary" loading={isValidating} onPress={onValidate}>
          {m.validation_submit()}
        </Button>
      </Stack>
    </Stack>
  );
}

/** Step 3 — findings pinned to the lines they point at, with the full list below. */
function ResultStep({
  resource,
  result,
  isValidating,
  onBack,
}: {
  resource: FhirResource;
  result: ValidationResult | undefined;
  isValidating: boolean;
  onBack: () => void;
}) {
  // The block shows our formatting, not the pasted text — line numbers are only
  // meaningful for the exact string the index was built from.
  const source = useMemo(() => formatResourceWithLines(resource), [resource]);
  const issues = result?.ok === true ? result.issues : [];
  const annotations = useMemo(
    () => toAnnotations(result?.ok === true ? result.issues : [], source.lineOf),
    [result, source],
  );
  const problems = issues.filter(isProblem);

  return (
    <Stack direction="vertical" gap="md">
      {isValidating || result === undefined ? (
        <Panel variant="notice" status="info">
          <Text>{m.validation_validating()}</Text>
        </Panel>
      ) : !result.ok ? (
        <Panel variant="alert" status="error">
          <Text>{m.validation_request_failed()}</Text>
        </Panel>
      ) : (
        <>
          {problems.length === 0 ? (
            <Panel variant="notice" status="success">
              <Text>{m.validation_no_problems()}</Text>
            </Panel>
          ) : (
            <Panel variant="alert" status="error">
              <Text>{m.validation_problems_found({ count: problems.length })}</Text>
            </Panel>
          )}

          <CodeBlock
            code={source.text}
            language="json"
            filename={`${resource.resourceType}.json`}
            annotations={annotations}
            showLineNumbers
          />

          {issues.length > 0 && <IssueTable issues={issues} />}
        </>
      )}

      <Stack direction="horizontal" gap="sm">
        <Button variant="secondary" onPress={onBack}>{m.validation_back()}</Button>
      </Stack>
    </Stack>
  );
}

function IssueTable({ issues }: { issues: ValidationIssue[]; }) {
  return (
    <Table>
      <Table.Header>
        <Table.Row>
          <Table.HeadCell>{m.validation_issue_severity()}</Table.HeadCell>
          <Table.HeadCell>{m.validation_issue_location()}</Table.HeadCell>
          <Table.HeadCell>{m.validation_issue_message()}</Table.HeadCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {issues.map((issue, index) => (
          <Table.Row key={index}>
            <Table.Cell>
              <Badge status={severityTone(issue.severity)}>{issue.severity}</Badge>
            </Table.Cell>
            <Table.Cell>{issue.expression.join(", ") || "—"}</Table.Cell>
            <Table.Cell>{issue.message || "—"}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}

/** Parses the pasted text; `null` while it is still empty, so nothing is flagged yet. */
function parseInput(text: string): ParsedInput | null {
  if (text.trim().length === 0) return null;

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, message: m.validation_invalid_json() };
  }

  if (!isResource(value) || !isValidFhirResourceTypeName(value.resourceType)) {
    return { ok: false, message: m.validation_not_a_resource() };
  }

  return { ok: true, resource: value };
}

/**
 * The profiles worth offering for the pasted resource: the ones it declares in
 * `meta.profile` first, then everything loaded for that type.
 */
function profileOptions(
  resource: FhirResource | null,
  profiles: ProfileInfo[] | null,
): SelectOption[] {
  const options: SelectOption[] = [{ value: NO_PROFILE, label: m.validation_profile_none() }];
  if (resource === null) return options;

  const declared = asStringArray(resource.meta?.profile).filter(
    (canonical) => canonical.length > 0,
  );
  const loaded = (profiles ?? [])
    .filter((candidate) => candidate.type === resource.resourceType)
    .map((candidate) => candidate.canonical);

  const seen = new Set<string>();
  for (const canonical of [...declared, ...loaded]) {
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const info = profiles?.find((candidate) => candidate.canonical === canonical);
    const name = info?.title ?? info?.name ?? canonical;
    options.push({
      value: canonical,
      label: declared.includes(canonical)
        ? `${name} — ${m.validation_profile_declared()}`
        : name,
    });
  }

  return options;
}

/** Issues that point at an element become inline notes; the rest stay in the table. */
function toAnnotations(
  issues: ValidationIssue[],
  lineOf: (expression: string) => number | null,
): CodeAnnotation[] {
  const annotations: CodeAnnotation[] = [];

  for (const issue of issues) {
    if (issue.expression.length === 0) continue;
    const line = lineOf(issue.expression[0]);
    if (line === null) continue;

    annotations.push({
      line,
      severity: severityTone(issue.severity),
      message: issue.message,
      code: issue.code ?? undefined,
      path: issue.expression.join(", "),
    });
  }

  return annotations;
}

function severityTone(severity: string): "error" | "warning" | "info" {
  if (severity === "fatal" || severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "info";
}

function isProblem(issue: ValidationIssue): boolean {
  return issue.severity === "fatal" || issue.severity === "error";
}

function stepItems(current: StepNumber, result: ValidationResult | undefined): Step[] {
  const labels = [
    m.validation_step_resource(),
    m.validation_step_profile(),
    m.validation_step_result(),
  ];

  return labels.map((label, index) => ({
    number: index + 1,
    label,
    status: stepStatus(index + 1, current, result),
  }));
}

function stepStatus(
  number: number,
  current: StepNumber,
  result: ValidationResult | undefined,
): StepStatus {
  const failed = result !== undefined && (!result.ok || result.issues.some(isProblem));
  if (number === 3 && current === 3 && failed) return "error";
  if (number < current) return "complete";
  if (number === current) return "current";
  return "upcoming";
}
