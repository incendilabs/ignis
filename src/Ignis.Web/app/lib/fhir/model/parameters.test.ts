/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, it } from "vitest";

import { getIntegerParameter } from "./parameters";

describe("getIntegerParameter", () => {
  const parameters = {
    resourceType: "Parameters",
    parameter: [{ name: "maxUploadSizeBytes", valueInteger: 52428800 }],
  };

  it("returns the named parameter's integer value", () => {
    expect(getIntegerParameter(parameters, "maxUploadSizeBytes")).toBe(52428800);
  });

  it("returns null for an absent parameter", () => {
    expect(getIntegerParameter(parameters, "missing")).toBeNull();
  });

  it("returns null when the payload is not a Parameters resource", () => {
    expect(getIntegerParameter({ resourceType: "OperationOutcome" }, "x")).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    expect(getIntegerParameter(null, "x")).toBeNull();
    expect(getIntegerParameter("nope", "x")).toBeNull();
  });

  it("returns null when the parameter has no integer value", () => {
    const noValue = { resourceType: "Parameters", parameter: [{ name: "x" }] };
    expect(getIntegerParameter(noValue, "x")).toBeNull();
  });
});
