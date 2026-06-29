/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Configuration;

/// <summary>
/// Bound from the <c>ProfileValidationSettings</c> configuration section. Controls where the
/// structural profile validator loads its FHIR conformance packages from.
/// </summary>
public sealed class ProfileValidationSettings
{
    /// <summary>
    /// Directory scanned for <c>*.tgz</c> conformance packages; empty uses the build-staged
    /// <c>fhir-packages</c> folder next to the app. In Kubernetes, a seeded PVC mount.
    /// </summary>
    public string? PackageDirectory { get; set; }
}
