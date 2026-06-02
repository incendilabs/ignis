/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Table } from "@eventuras/ratio-ui/core/Table";
import { Text } from "@eventuras/ratio-ui/core/Text";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

export interface DataTableProps<TData> {
  /** Rows for the current page; the caller owns pagination and sorting. */
  data: TData[];
  columns: ColumnDef<TData>[];
  /** Shown in place of the table when there are no rows. */
  emptyMessage?: string;
  /**
   * Derives a stable row id from the row data (e.g. a FHIR resource `id`)
   * instead of the positional index, so keys survive re-paging and re-sorting.
   */
  getRowId?: (row: TData, index: number) => string;
}

/**
 * Presentation-only wrapper around TanStack Table, rendered through the
 * ratio-ui {@link Table} primitives.
 *
 * Wires only the core row model — no client-side sorting, filtering, or
 * pagination — because the FHIR Bundles it renders are paged and sorted on
 * the server.
 *
 * Flat columns only: header cells omit `colSpan` (ratio-ui's HeadCell has
 * none), so grouped / multi-level columns would misalign.
 */
export function DataTable<TData>({
  data,
  columns,
  emptyMessage = "No results.",
  getRowId,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return <Text>{emptyMessage}</Text>;
  }

  return (
    <Table>
      <Table.Header>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Row key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Table.HeadCell key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </Table.HeadCell>
            ))}
          </Table.Row>
        ))}
      </Table.Header>
      <Table.Body>
        {table.getRowModel().rows.map((row) => (
          <Table.Row key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <Table.Cell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
