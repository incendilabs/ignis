/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { ReactNode } from "react";

import { m } from "#app/i18n/paraglide/messages";
import type { Resource } from "#app/lib/fhir/model";

import { QuestionnaireItemTree } from "./QuestionnaireItemTree";

/** A FHIR resource type name, e.g. "Questionnaire". */
type ResourceType = string;

export interface ResourceDetailTabContext {
  resource: Resource;
  resourceType: ResourceType;
  id: string;
}

/**
 * Tab for extra details on resource detail page. 
 */
export interface ResourceDetailTab {
  id: string;
  title: () => string;
  render: (context: ResourceDetailTabContext) => ReactNode;
}

/**
 * Type-specific tabs keyed by FHIR resourceType.
 */
const registry: Record<ResourceType, ResourceDetailTab[]> = {
  Questionnaire: [
    {
      id: "form",
      title: () => m.resources_instance_tab_form(),
      render: ({ resource }) => <QuestionnaireItemTree resource={resource} />,
    },
  ],
};

/** Get extra tabs registered for a resource type. */
export function resourceDetailTabsFor(resourceType: ResourceType): ResourceDetailTab[] {
  return registry[resourceType] ?? [];
}
