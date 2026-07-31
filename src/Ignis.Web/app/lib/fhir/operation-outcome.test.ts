/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { getOperationOutcomeDetails, getOperationOutcomeIssues } from "./operation-outcome";

describe("getOperationOutcomeDetails", () => {
  it("extracts the id and first non-empty diagnostic", () => {
    const payload = {
      resourceType: "OperationOutcome",
      id: "op-123",
      issue: [
        { diagnostics: "" },
        { diagnostics: "Imported 6 resources" },
        { diagnostics: "ignored" },
      ],
    };

    expect(getOperationOutcomeDetails(payload)).toEqual({
      operationId: "op-123",
      message: "Imported 6 resources",
    });
  });

  it("returns an empty object for a non-OperationOutcome payload", () => {
    expect(getOperationOutcomeDetails({ resourceType: "Patient", id: "p1" }))
      .toEqual({});
  });

  it("returns an empty object for non-object input", () => {
    expect(getOperationOutcomeDetails(null)).toEqual({});
    expect(getOperationOutcomeDetails("nope")).toEqual({});
  });

  it("omits the message when no issue carries a diagnostic", () => {
    const payload = {
      resourceType: "OperationOutcome",
      id: "op-9",
      issue: [{}, {}],
    };

    expect(getOperationOutcomeDetails(payload)).toEqual({ operationId: "op-9" });
  });
});

describe("getOperationOutcomeIssues", () => {
  it("returns every issue with its validation fields", () => {
    const payload = {
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "error",
          code: "invariant",
          diagnostics: "dom-6 failed",
          expression: ["Patient.contact[0]"],
        },
        { severity: "warning", details: { text: "Unknown extension" } },
      ],
    };

    expect(getOperationOutcomeIssues(payload)).toEqual(payload.issue);
  });

  it("returns an empty list for non-outcome or issueless payloads", () => {
    expect(getOperationOutcomeIssues({ resourceType: "Patient" })).toEqual([]);
    expect(getOperationOutcomeIssues({ resourceType: "OperationOutcome" })).toEqual([]);
    expect(getOperationOutcomeIssues(null)).toEqual([]);
  });
});
