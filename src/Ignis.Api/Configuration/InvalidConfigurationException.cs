/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Configuration;

/// <summary>
/// Thrown at startup when a configuration value is present but malformed.
/// </summary>
public sealed class InvalidConfigurationException : Exception
{
    public InvalidConfigurationException(string message) : base(message)
    {
    }
}
