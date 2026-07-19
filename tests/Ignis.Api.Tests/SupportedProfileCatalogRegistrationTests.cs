/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Ignis.Api.Configuration;
using Ignis.Api.Extensions;
using Ignis.Api.Services.Validation;

using Microsoft.Extensions.DependencyInjection;

namespace Ignis.Api.Tests;

public class SupportedProfileCatalogRegistrationTests
{
    [Fact]
    public async Task Empty_package_directory_yields_an_empty_catalog()
    {
        var dir = Directory.CreateTempSubdirectory();
        try
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.Configure<ProfileValidationSettings>(o => o.PackageDirectory = dir.FullName);
            services.AddProfileValidation();

            var catalog = services.BuildServiceProvider().GetRequiredService<ISupportedProfileCatalog>();

            (await catalog.ProfilesByTypeAsync()).Should().BeEmpty();
        }
        finally
        {
            dir.Delete(recursive: true);
        }
    }
}
