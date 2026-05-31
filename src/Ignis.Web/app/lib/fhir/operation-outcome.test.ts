/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { getOperationOutcomeDetails } from "./operation-outcome";

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
