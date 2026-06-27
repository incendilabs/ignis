/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

namespace Ignis.Validation;

/// <summary>
/// Validates a resource structurally against a profile and returns the verdict as an
/// <see cref="OperationOutcome"/>. 
/// </summary>
public interface IProfileValidationService
{
    /// <summary>
    /// Validates against <paramref name="profile"/>, or — when null — the resource's base type. Profiles
    /// in <c>meta.profile</c> are always validated too. Failures are reported as issues in the outcome.
    /// </summary>
    OperationOutcome Validate(Resource resource, string? profile = null);
}
