/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

using Ignis.Api.Extensions;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using OpenIddict.Validation.AspNetCore;

using Spark.Engine.Core;

namespace Ignis.Api.Controllers;

/// <summary>
/// Lists the FHIR packages loaded on the server from disk — the source the
/// package profiles (see <see cref="ProfilesController"/>) are resolved from.
/// </summary>
[Route("fhir"), ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class PackagesController(IPackageCatalog packages) : ControllerBase
{
    /// <summary>The loaded packages as a Parameters resource — one <c>package</c> part (id + version) each.</summary>
    [HttpGet("$packages"), Tags("Conformance")]
    public FhirResponse GetPackages()
    {
        var parameters = new Parameters();
        foreach (var package in packages.Packages)
        {
            var entry = new Parameters.ParameterComponent { Name = "package" };
            entry.Part.Add(new Parameters.ParameterComponent { Name = "id", Value = new FhirString(package.Id) });
            if (package.Version is not null)
                entry.Part.Add(new Parameters.ParameterComponent { Name = "version", Value = new FhirString(package.Version) });
            parameters.Parameter.Add(entry);
        }

        return Respond.WithResource(parameters);
    }
}
