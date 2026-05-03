/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;

using Microsoft.AspNetCore.HttpOverrides;

namespace Ignis.Api.Configuration;

public static class ForwardedHeadersExtensions
{
    /// <summary>
    /// Configures the Forwarded Headers Middleware from
    /// <see cref="ForwardedHeadersSettings"/>. No-op when neither
    /// <see cref="ForwardedHeadersSettings.KnownProxies"/> nor
    /// <see cref="ForwardedHeadersSettings.KnownNetworks"/> has entries —
    /// callers should gate <c>UseForwardedHeaders()</c> on the same condition.
    /// </summary>
    public static IServiceCollection ConfigureForwardedHeaders(
        this IServiceCollection services,
        ForwardedHeadersSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);

        if (!settings.IsConfigured)
            return services;

        var proxies = ParseProxies(settings.KnownProxies);
        var networks = ParseNetworks(settings.KnownNetworks);

        services.Configure<ForwardedHeadersOptions>(options =>
        {
            // XForwardedHost is omitted: with permissive AllowedHosts it would enable host-injection.
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
                | ForwardedHeaders.XForwardedProto;
            foreach (var ip in proxies) options.KnownProxies.Add(ip);
            foreach (var net in networks) options.KnownIPNetworks.Add(net);
        });

        return services;
    }

    private static List<IPAddress> ParseProxies(List<string> raw)
    {
        var parsed = new List<IPAddress>();
        foreach (var proxy in raw)
        {
            if (!IPAddress.TryParse(proxy, out var ip))
                throw new ArgumentException(
                    $"ForwardedHeaders:KnownProxies contains an invalid IP address (got '{proxy}').");
            parsed.Add(ip);
        }
        return parsed;
    }

    private static List<System.Net.IPNetwork> ParseNetworks(List<string> raw)
    {
        var parsed = new List<System.Net.IPNetwork>();
        foreach (var network in raw)
        {
            if (!System.Net.IPNetwork.TryParse(network, out var net))
                throw new ArgumentException(
                    $"ForwardedHeaders:KnownNetworks contains an invalid CIDR network (got '{network}').");
            parsed.Add(net);
        }
        return parsed;
    }
}
