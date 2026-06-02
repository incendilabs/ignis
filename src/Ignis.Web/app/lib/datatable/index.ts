/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

export { DataTable } from "./datatable";
export type { DataTableProps } from "./datatable";

// Re-exported so consumers type their column arrays without depending on
// @tanstack/react-table directly. Build columns as plain objects, e.g.
// `const columns: ColumnDef<Row>[] = [{ accessorKey: "id", header: "Id" }]`.
export type { ColumnDef } from "@tanstack/react-table";
