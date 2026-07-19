/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Validation;

namespace Ignis.Api.Configuration;

/// <summary>
/// Bound from the <c>Validation</c> configuration section. Controls where the structural profile
/// validator loads its FHIR conformance packages from, and how <c>$validate</c> parses request bodies.
/// </summary>
public sealed class ValidationSettings
{
    /// <summary>
    /// Directory scanned for <c>*.tgz</c> conformance packages; empty uses the build-staged
    /// <c>fhir-packages</c> folder next to the app. In Kubernetes, a seeded PVC mount.
    /// </summary>
    public string? PackageDirectory { get; set; }

    /// <summary>
    /// How <c>$validate</c> parses request bodies. Defaults to <see cref="ResourceParsingMode.Permissive"/>
    /// so malformed values become findings; <see cref="ResourceParsingMode.Strict"/> rejects them instead.
    /// </summary>
    public ResourceParsingMode Parsing { get; set; } = ResourceParsingMode.Permissive;
}
