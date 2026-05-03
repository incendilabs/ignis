/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Api.Configuration;
using Ignis.Auth;

namespace Ignis.Api.Extensions;

public static class StartupLoggingExtensions
{
    /// <summary>
    /// Logs a snapshot of deployment-relevant configuration at app start.
    /// </summary>
    public static void LogStartupConfig(
        this WebApplication app,
        AuthSettings authSettings,
        ForwardedHeadersSettings forwardedHeadersSettings)
    {
        app.Logger.LogInformation("Starting Ignis API.");

        app.Logger.LogInformation(
            "Issuer: {Issuer}.",
            string.IsNullOrWhiteSpace(authSettings.Issuer) ? "(derived from request)" : authSettings.Issuer);

        var forwardedHeadersEnabled = forwardedHeadersSettings.KnownProxies.Count > 0
            || forwardedHeadersSettings.KnownNetworks.Count > 0;
        if (forwardedHeadersEnabled)
        {
            app.Logger.LogInformation(
                "Forwarded headers trusted: proxies={Proxies}, networks={Networks}.",
                forwardedHeadersSettings.KnownProxies,
                forwardedHeadersSettings.KnownNetworks);
        }
        else
        {
            app.Logger.LogInformation("Forwarded headers: disabled.");
        }
    }
}
