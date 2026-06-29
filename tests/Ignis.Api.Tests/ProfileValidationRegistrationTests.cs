/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Hl7.Fhir.Model;

using Ignis.Api.Configuration;
using Ignis.Api.Extensions;
using Ignis.Validation;

using Microsoft.Extensions.DependencyInjection;

namespace Ignis.Api.Tests;

public class ProfileValidationRegistrationTests
{
    [Fact]
    public void Empty_package_directory_does_not_throw_and_validate_degrades()
    {
        var dir = Directory.CreateTempSubdirectory();
        try
        {
            var services = new ServiceCollection();
            services.AddLogging();
            services.Configure<ProfileValidationSettings>(o => o.PackageDirectory = dir.FullName);
            services.AddProfileValidation();

            // Resolving must not throw even though the directory has no packages.
            var validator = services.BuildServiceProvider().GetRequiredService<IProfileValidationService>();

            validator.Validate(new Patient()).Issue
                .Should().Contain(i => i.Code == OperationOutcome.IssueType.NotFound);
        }
        finally
        {
            dir.Delete(recursive: true);
        }
    }
}
