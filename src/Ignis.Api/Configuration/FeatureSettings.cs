/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Configuration;

/// <summary>
/// Feature flags bound from the <c>FeatureManagement</c> configuration section.
/// </summary>
public sealed class FeatureSettings
{
    /// <summary>
    /// When <c>false</c> (default), the <c>$clear-store</c> endpoint responds
    /// with <c>404 Not Found</c> regardless of scope — a defence-in-depth
    /// switch on top of <c>maintenance/database.destructive</c>.
    /// </summary>
    public bool AllowClearStore { get; set; }
}
