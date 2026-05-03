/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Configuration;

/// <summary>
/// Bound from the <c>ForwardedHeaders</c> configuration section. Trusted-proxy
/// allow-list for the Forwarded Headers Middleware. Since .NET 8.0.17 / 9.0.6,
/// <c>X-Forwarded-*</c> headers are ignored unless the proxy IP is in
/// <see cref="KnownProxies"/> or its network is in <see cref="KnownNetworks"/>.
/// Leave both empty to disable the middleware entirely. See
/// <see href="https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer"/>.
/// </summary>
public sealed class ForwardedHeadersSettings
{
    /// <summary>Individual proxy IPv4/IPv6 addresses (e.g. <c>127.0.0.1</c>).</summary>
    public List<string> KnownProxies { get; set; } = [];

    /// <summary>CIDR networks (e.g. <c>10.0.0.0/8</c>, <c>fd00::/8</c>).</summary>
    public List<string> KnownNetworks { get; set; } = [];

    public bool IsConfigured
    {
        get
        {
            var hasTrustedProxy = KnownProxies?.Count > 0;
            var hasTrustedNetwork = KnownNetworks?.Count > 0;
            return hasTrustedProxy || hasTrustedNetwork;
        }
    }
}
