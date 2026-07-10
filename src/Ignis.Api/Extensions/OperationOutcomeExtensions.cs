/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

namespace Ignis.Api.Extensions;

/// <summary>
/// Ignis-local complements to <c>Spark.Engine.Extensions.OperationOutcomeExtensions</c>
/// for patterns specific to our maintenance operations.
/// </summary>
public static class OperationOutcomeExtensions
{
    /// <summary>
    /// Tags the outcome with an operation id (as the FHIR resource Id) and
    /// sets <c>Meta.LastUpdated</c> to now. Lets clients correlate the
    /// synchronous response with subsequent operation progress hub events.
    /// </summary>
    public static OperationOutcome WithOperationId(this OperationOutcome outcome, Guid operationId)
    {
        outcome.Id = operationId.ToString();
        outcome.Meta = new Meta { LastUpdated = DateTimeOffset.UtcNow };
        return outcome;
    }

    /// <summary>
    /// Adds an <see cref="OperationOutcome.IssueSeverity.Information"/> issue
    /// with an <see cref="OperationOutcome.IssueType.Informational"/> code —
    /// complements Spark's <c>AddError</c> for the success-path counterpart.
    /// </summary>
    public static OperationOutcome AddInformationIssue(this OperationOutcome outcome, string message)
    {
        outcome.Issue.Add(new OperationOutcome.IssueComponent
        {
            Severity = OperationOutcome.IssueSeverity.Information,
            Code = OperationOutcome.IssueType.Informational,
            Diagnostics = message,
        });
        return outcome;
    }

    /// <summary>
    /// Adds an <see cref="OperationOutcome.IssueSeverity.Error"/> issue with an
    /// <see cref="OperationOutcome.IssueType.Invalid"/> code — for malformed or
    /// conflicting client input. (Spark's <c>AddError</c> omits the required
    /// <c>issue.code</c>, so strict clients reject its outcomes.)
    /// </summary>
    public static OperationOutcome AddInvalidIssue(this OperationOutcome outcome, string message)
    {
        outcome.Issue.Add(new OperationOutcome.IssueComponent
        {
            Severity = OperationOutcome.IssueSeverity.Error,
            Code = OperationOutcome.IssueType.Invalid,
            Diagnostics = message,
        });
        return outcome;
    }
}
