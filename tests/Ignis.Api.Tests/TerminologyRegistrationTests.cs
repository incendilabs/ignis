/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Ignis.Api.Configuration;
using Ignis.Api.Extensions;
using Ignis.Terminology;

using Microsoft.Extensions.DependencyInjection;

namespace Ignis.Api.Tests;

public class TerminologyRegistrationTests
{
    [Fact]
    public void Empty_package_directory_does_not_throw()
    {
        var dir = Directory.CreateTempSubdirectory();
        try
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.Configure<ValidationSettings>(o => o.PackageDirectory = dir.FullName);
            services.AddTerminology();

            // Building the singleton must not throw even with no packages (degrades to inline-only expansion).
            var expander = services.BuildServiceProvider().GetRequiredService<IValueSetExpansionService>();

            expander.Should().NotBeNull();
        }
        finally
        {
            dir.Delete(recursive: true);
        }
    }
}
