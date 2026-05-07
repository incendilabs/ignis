/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { scopes } from "./scopes";

export const maintenanceOperations = {
  rebuildIndex: {
    intent: "rebuild-index",
    endpoint: "$rebuild-index",
    requiredScope: scopes.maintenanceDatabaseWrite,
    successMessage: "Index rebuild completed.",
  },
  clearStore: {
    intent: "clear-store",
    endpoint: "$clear-store",
    requiredScope: scopes.maintenanceDatabaseDestructive,
    successMessage: "Database store reset completed.",
  },
} as const;

export type MaintenanceIntent =
  (typeof maintenanceOperations)[keyof typeof maintenanceOperations]["intent"];

export interface OperationResult {
  ok: boolean;
  message: string;
  operationId?: string;
}

export type MaintenanceOperation =
  (typeof maintenanceOperations)[keyof typeof maintenanceOperations];

export function getMaintenanceOperation(intent: FormDataEntryValue | null): MaintenanceOperation | null {
  if (intent === maintenanceOperations.rebuildIndex.intent) {
    return maintenanceOperations.rebuildIndex;
  }

  if (intent === maintenanceOperations.clearStore.intent) {
    return maintenanceOperations.clearStore;
  }

  return null;
}
