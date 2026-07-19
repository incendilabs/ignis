/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Validation;

/// <summary>How <c>$validate</c> parses request bodies. Set via the host's <c>Validation:Parsing</c> setting.</summary>
public enum ResourceParsingMode
{
    /// <summary>Parse problems become outcome issues; validation runs on the partial resource.</summary>
    Permissive,

    /// <summary>Reject bodies the parser cannot fully read.</summary>
    Strict,
}
