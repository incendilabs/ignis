/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

export const scopes = {
  operationsRead: "operations.read",
  operationsImport: "operations.import",
  maintenanceDatabaseWrite: "maintenance/database.write",
  maintenanceDatabaseDestructive: "maintenance/database.destructive",
} as const;
