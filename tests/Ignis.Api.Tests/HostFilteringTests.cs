/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Ignis.Api.Configuration;

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;

namespace Ignis.Api.Tests;

public class HostFilteringTests
{
    [Fact]
    public void ConfigureAllowedHosts_Throws_WhenMissing()
    {
        // CreateEmptyBuilder loads no default config sources, so AllowedHosts
        // is genuinely absent and the validation should fire.
        var builder = WebApplication.CreateEmptyBuilder(new());

        var act = () => builder.ConfigureAllowedHosts();

        act.Should().Throw<ArgumentException>()
            .WithMessage("*AllowedHosts*");
    }

    [Fact]
    public void ConfigureAllowedHosts_Passes_WhenSet()
    {
        var builder = WebApplication.CreateEmptyBuilder(new());
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AllowedHosts"] = "api.example.com",
        });

        var act = () => builder.ConfigureAllowedHosts();

        act.Should().NotThrow();
    }
}
