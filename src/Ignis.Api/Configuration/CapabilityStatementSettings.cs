/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Configuration;

/// <summary>Bound from the <c>CapabilityStatementSettings</c> section: what <c>/fhir/metadata</c> says
/// this deployment is.</summary>
public sealed class CapabilityStatementSettings
{
    /// <summary>
    /// <c>CapabilityStatement.implementation.description</c>. The default claims only what holds for an
    /// unconfigured deployment, so a server holding real data has to say so deliberately.
    /// </summary>
    public string ImplementationDescription { get; set; } =
        "Development and test FHIR server. Do not send real patient data or any personal information.";
}
