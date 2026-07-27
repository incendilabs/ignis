/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;
using Hl7.Fhir.Utility;

using Ignis.Api.Services.Validation;
using Ignis.Validation;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using OpenIddict.Validation.AspNetCore;

using Spark.Engine.Core;

namespace Ignis.Api.Controllers;

/// <summary>
/// The resource-constraint profiles loaded from the server's FHIR packages — the
/// <c>supportedProfile</c> set, with each one's name/title/version/status.
/// </summary>
[Route("fhir"), ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class ProfilesController(ISupportedProfileCatalog catalog) : ControllerBase
{
    /// <summary>The loaded profiles as a searchset Bundle of StructureDefinition summaries.</summary>
    [HttpGet("StructureDefinition/$profiles"), Tags("Conformance")]
    public async Task<FhirResponse> GetProfiles()
    {
        var profiles = await catalog.ProfilesAsync().ConfigureAwait(false);

        var bundle = new Bundle { Type = Bundle.BundleType.Searchset, Total = profiles.Count };
        foreach (var profile in profiles)
            bundle.AddResourceEntry(ToStructureDefinitionMetadata(profile), profile.Canonical);

        return Respond.WithResource(bundle);
    }

    /// <summary>A metadata-only StructureDefinition (no snapshot/differential) for the Bundle.</summary>
    private static StructureDefinition ToStructureDefinitionMetadata(ProfileSummary profile) => new()
    {
        Url = profile.Canonical,
        Name = profile.Name,
        Title = profile.Title,
        Version = profile.Version,
        Status = string.IsNullOrEmpty(profile.Status)
            ? null
            : EnumUtility.ParseLiteral<PublicationStatus>(profile.Status),
        Type = profile.ConstrainedType,
        Kind = StructureDefinition.StructureDefinitionKind.Resource,
        Abstract = false, // required (1..1); summaries are concrete constraint profiles
        Derivation = StructureDefinition.TypeDerivationRule.Constraint,
    };
}
