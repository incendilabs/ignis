/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Configuration;

public static class HostFilteringExtensions
{
    /// <summary>
    /// Requires AllowedHosts to be configured. ASP.NET's default builder falls back 
    /// to <c>"*"</c> when AllowedHosts is unset, which silently accepts every Host 
    /// header — operators should declare the allow-list explicitly. Use <c>"*"</c> 
    /// in dev to opt out of filtering.
    /// </summary>
    public static WebApplicationBuilder ConfigureAllowedHosts(this WebApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        var allowedHosts = builder.Configuration["AllowedHosts"];
        if (string.IsNullOrWhiteSpace(allowedHosts))
        {
            throw new ArgumentException(
                "AllowedHosts must be set. Configure a semicolon-separated list of "
                + "accepted hostnames (or \"*\" to disable filtering explicitly).");
        }

        return builder;
    }
}
