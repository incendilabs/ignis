/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Configuration;

/// <summary>
/// Thrown at startup when a required configuration value is missing.
/// </summary>
public sealed class MissingConfigurationException : Exception
{
    public MissingConfigurationException(string message) : base(message)
    {
    }
}
