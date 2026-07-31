/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { formatResourceWithLines, type ResourceLines } from "./resource-lines";

const patient = {
  resourceType: "Patient",
  id: "example",
  active: true,
  name: [
    { use: "official", family: "Losen", given: ["Leo", "Los"] },
    { use: "nickname", given: ["Leo"] },
  ],
  contact: [],
};

/** The formatted line an expression resolves to, for asserting on content rather than a number. */
function lineText(source: ResourceLines, expression: string): string | null {
  const line = source.lineOf(expression);
  return line === null ? null : (source.text.split("\n")[line - 1] ?? null);
}

describe("formatResourceWithLines", () => {
  it("formats the resource as indented JSON that parses back", () => {
    const source = formatResourceWithLines(patient);

    expect(JSON.parse(source.text)).toEqual(patient);
    expect(source.text.split("\n")[0]).toBe("{");
    expect(source.text).toContain(`  "id": "example"`);
  });

  it("locates the resource root on line 1", () => {
    expect(formatResourceWithLines(patient).lineOf("Patient")).toBe(1);
  });

  it("locates elements at the line their key is written on", () => {
    const source = formatResourceWithLines(patient);

    expect(lineText(source, "Patient.active")).toContain(`"active": true`);
    expect(lineText(source, "Patient.name")).toContain(`"name": [`);
    expect(lineText(source, "Patient.name[1].use")).toContain(`"use": "nickname"`);
    expect(lineText(source, "Patient.name[0].given[1]")).toContain(`"Los"`);
  });

  it("assumes the first entry when a repeating element carries no index", () => {
    const source = formatResourceWithLines(patient);

    expect(source.lineOf("Patient.name.given")).toBe(source.lineOf("Patient.name[0].given"));
  });

  it("accepts expressions that leave out the resource type", () => {
    const source = formatResourceWithLines(patient);

    expect(source.lineOf("name[1].use")).toBe(source.lineOf("Patient.name[1].use"));
  });

  it("drops FHIRPath calls such as ofType()", () => {
    const source = formatResourceWithLines({
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: { resourceType: "Patient", active: false } }],
    });

    expect(lineText(source, "Bundle.entry[0].resource.ofType(Patient).active"))
      .toContain(`"active": false`);
  });

  it("falls back to the nearest ancestor when the element is absent", () => {
    const source = formatResourceWithLines(patient);

    // name[9] does not exist, so the finding belongs on `name` itself.
    expect(source.lineOf("Patient.name[9].family")).toBe(source.lineOf("Patient.name"));
    expect(source.lineOf("Patient.unknownElement")).toBe(1);
  });

  it("keeps empty arrays on one line and still locates them", () => {
    const source = formatResourceWithLines(patient);

    expect(source.text).toContain(`"contact": []`);
    expect(lineText(source, "Patient.contact")).toContain(`"contact": []`);
  });

  it("keeps the output parseable when an array carries no value at an index", () => {
    const source = formatResourceWithLines({
      resourceType: "Patient",
      // eslint-disable-next-line no-sparse-arrays -- the hole is the point
      name: [{ family: "Test" }, , undefined],
    });

    expect(source.text).not.toContain("undefined");
    expect(() => { JSON.parse(source.text); }).not.toThrow();
    // The surviving entries must still line up with their indices.
    expect(source.lineOf("Patient.name[0].family")).not.toBeNull();
  });

  it("returns null for an empty expression", () => {
    expect(formatResourceWithLines(patient).lineOf("")).toBeNull();
  });
});
