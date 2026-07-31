/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { isObject } from "../guards";
import type { Resource } from "../model";

/** A formatted resource, plus a lookup from FHIRPath expression to line. */
export interface ResourceLines {
  /** The formatted JSON. Line numbers are only valid for this exact text. */
  text: string;
  /** 1-based line for an expression; the nearest known ancestor when the exact element is missing. */
  lineOf: (expression: string) => number | null;
}

const INDENT = "  ";

/**
 * Formats a resource as JSON while recording where each element lands, so
 * $validate's FHIRPath expressions can be pinned to a line.
 */
export function formatResourceWithLines(
  resource: Resource & { resourceType: string; },
): ResourceLines {
  const lines: string[] = [];
  const lineByPath = new Map<string, number>();

  const emit = (prefix: string, value: unknown, indent: string, path: string, suffix: string) => {
    lineByPath.set(path, lines.length + 1);

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${indent}${prefix}[]${suffix}`);
        return;
      }
      lines.push(`${indent}${prefix}[`);
      // Indexed rather than forEach, which skips holes in a sparse array and would
      // shift the remaining elements onto the wrong lines.
      for (let index = 0; index < value.length; index++) {
        const last = index === value.length - 1;
        emit("", value[index], indent + INDENT, `${path}[${String(index)}]`, last ? "" : ",");
      }
      lines.push(`${indent}]${suffix}`);
      return;
    }

    if (isObject(value)) {
      const entries = Object.entries(value).filter(([, child]) => child !== undefined);
      if (entries.length === 0) {
        lines.push(`${indent}${prefix}{}${suffix}`);
        return;
      }
      lines.push(`${indent}${prefix}{`);
      entries.forEach(([key, child], index) => {
        const last = index === entries.length - 1;
        emit(`${JSON.stringify(key)}: `, child, indent + INDENT, `${path}.${key}`, last ? "" : ",");
      });
      lines.push(`${indent}}${suffix}`);
      return;
    }

    // JSON.stringify gives back undefined for an undefined value, which would land in
    // the text as the literal word and make the output unparseable.
    const literal = value === undefined ? "null" : JSON.stringify(value);
    lines.push(`${indent}${prefix}${literal}${suffix}`);
  };

  emit("", resource, "", resource.resourceType, "");

  return {
    text: lines.join("\n"),
    lineOf: (expression) => lineOf(expression, resource.resourceType, lineByPath),
  };
}

/**
 * Walks an expression segment by segment, so a path that runs out mid-way still
 * resolves to its deepest known ancestor rather than nothing.
 */
function lineOf(
  expression: string,
  resourceType: string,
  lineByPath: Map<string, number>,
): number | null {
  const parts = segments(expression);
  if (parts.length === 0) return null;

  let path = resourceType;
  let line = lineByPath.get(path) ?? null;

  // The validator may or may not lead with the resource type.
  for (const part of parts[0] === resourceType ? parts.slice(1) : parts) {
    // Indices are often left off repeating elements, on the segment itself or
    // on its parent; the first entry is the best guess a line number can offer.
    const resolved = firstKnown(lineByPath, [
      `${path}.${part}`,
      `${path}.${part}[0]`,
      `${path}[0].${part}`,
      `${path}[0].${part}[0]`,
    ]);

    if (resolved === null) {
      // The entry itself is missing, so pin to the repeating element instead.
      const base = part.replace(/\[\d+\]$/, "");
      const ancestor = firstKnown(lineByPath, [`${path}.${base}`, `${path}[0].${base}`]);
      if (ancestor !== null) line = lineByPath.get(ancestor) ?? line;
      break;
    }

    path = resolved;
    line = lineByPath.get(resolved) ?? line;
  }

  return line;
}

function firstKnown(lineByPath: Map<string, number>, candidates: string[]): string | null {
  return candidates.find((candidate) => lineByPath.has(candidate)) ?? null;
}

/** Element segments of an expression, with FHIRPath calls like `ofType(X)` dropped. */
function segments(expression: string): string[] {
  return expression
    .replace(/\.[A-Za-z]+\([^)]*\)/g, "")
    .split(".")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}
