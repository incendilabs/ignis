/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Firely.Fhir.Packages;

using FluentAssertions;

using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;
using Hl7.Fhir.Specification.Source;
using Hl7.Fhir.Specification.Terminology;

namespace Ignis.Validation.Tests;

/// <summary>
/// Builds the validator over the FHIR packages staged on disk by the <c>fhir-packages</c> build target
/// (no network at test time). Compiling schemas is expensive, so it is done once for the test class.
/// </summary>
public sealed class R4CoreFixture
{
    public IProfileValidationService Validator { get; }

    /// <summary>The package source and terminology behind <see cref="Validator"/>, for tests that build their own.</summary>
    public IAsyncResourceResolver Core { get; }

    public ICodeValidationTerminologyService Terminology { get; }

    public R4CoreFixture()
    {
        var directory = Path.Combine(AppContext.BaseDirectory, "fhir-packages");
        var packages = Directory.Exists(directory) ? Directory.GetFiles(directory, "*.tgz") : [];
        if (packages.Length == 0)
            throw new InvalidOperationException(
                $"No FHIR packages found in '{directory}'. They are staged at build time by fhir-packages.targets.");

        Core = new FhirPackageSource(ModelInfo.ModelInspector, packages);
        Terminology = LocalTerminologyService.CreateDefaultForCore(Core);
        Validator = new ProfileValidationService(Core, Terminology);
    }
}

public sealed class ProfileValidationServiceTests : IClassFixture<R4CoreFixture>, IDisposable
{
    private readonly R4CoreFixture _fixture;
    private readonly IProfileValidationService _validator;
    private readonly List<DirectoryInfo> _staged = [];

    public ProfileValidationServiceTests(R4CoreFixture fixture)
    {
        _fixture = fixture;
        _validator = fixture.Validator;
    }

    public void Dispose()
    {
        foreach (var directory in _staged)
            directory.Delete(recursive: true);
    }

    private static IEnumerable<string?> Errors(OperationOutcome outcome) => outcome.Issue
        .Where(i => i.Severity is OperationOutcome.IssueSeverity.Error or OperationOutcome.IssueSeverity.Fatal)
        .Select(i => i.Details?.Text ?? i.Diagnostics ?? i.Code.ToString());

    /// <summary>The packages plus one profile staged on disk, since no SDK resolver serves resources from memory.</summary>
    private IAsyncResourceResolver ResolverWith(StructureDefinition profile)
    {
        var directory = Directory.CreateTempSubdirectory("ignis-profile-");
        _staged.Add(directory);
        File.WriteAllText(Path.Combine(directory.FullName, "profile.json"), profile.ToJson());

        return new MultiResolver(
            new CommonDirectorySource(ModelInfo.ModelInspector, directory.FullName),
            _fixture.Core);
    }

    [Fact]
    public void Valid_resource_validates_clean_against_its_base_type()
    {
        var patient = new Patient { Active = true, Name = { new HumanName { Family = "Losen", Given = ["Leo"] } }, };

        var outcome = _validator.Validate(patient);

        Errors(outcome).Should().BeEmpty();
        // A clean validation also reports a single information issue (OperationOutcome.issue is 1..*).
        outcome.Issue.Should().ContainSingle().Which.Severity.Should().Be(OperationOutcome.IssueSeverity.Information);
    }

    [Fact]
    public void Resource_missing_required_elements_reports_errors()
    {
        // Observation.status (1..1) and Observation.code (1..1) are both missing.
        var outcome = _validator.Validate(new Observation());

        Errors(outcome).Should().ContainMatch("*status*").And.ContainMatch("*code*");
    }

    [Fact]
    public void Unknown_profile_is_reported_not_thrown()
    {
        var outcome = _validator.Validate(new Patient(), "http://example.org/StructureDefinition/does-not-exist");

        var issue = outcome.Issue.Should().ContainSingle().Which;
        issue.Severity.Should().Be(OperationOutcome.IssueSeverity.Error);
        issue.Code.Should().Be(OperationOutcome.IssueType.NotFound);
        (issue.Details?.Text ?? "").Should().Contain("does-not-exist");
    }

    [Fact]
    public void Profile_with_unresolvable_dependencies_is_reported_not_thrown()
    {
        var validator = new ProfileValidationService(
            ResolverWith(UnresolvableProfile.Definition), _fixture.Terminology);

        var outcome = validator.Validate(new Patient(), UnresolvableProfile.Url);

        var issue = outcome.Issue.Should().ContainSingle().Which;
        issue.Severity.Should().Be(OperationOutcome.IssueSeverity.Error);
        issue.Code.Should().Be(OperationOutcome.IssueType.NotSupported);
        (issue.Details?.Text ?? "")
            .Should().Contain(UnresolvableProfile.Url)
            .And.Contain(UnresolvableProfile.MissingDependency);
    }

    [Fact]
    public void Coded_binding_is_validated_with_local_terminology()
    {
        // Patient.gender has a required binding to a value set in r4.core; local terminology validates
        // the code cleanly, so the only issue is the success notice — no "not verified" warning.
        var outcome = _validator.Validate(new Patient { Gender = AdministrativeGender.Male });

        outcome.Issue.Should().OnlyContain(i => i.Severity == OperationOutcome.IssueSeverity.Information);
    }

    [Fact]
    public void Profile_in_meta_profile_is_validated()
    {
        // A bare Observation (status + code) is valid against the base Observation type...
        var observation = new Observation
        {
            Status = ObservationStatus.Final,
            Code = new CodeableConcept("http://loinc.org", "85354-9"),
        };
        Errors(_validator.Validate(observation)).Should().BeEmpty();

        // ...but declaring the vital-signs profile via meta.profile makes the engine enforce it too,
        // and that profile requires a category this resource lacks — so the same resource now fails.
        observation.Meta = new Meta { Profile = ["http://hl7.org/fhir/StructureDefinition/vitalsigns"] };
        Errors(_validator.Validate(observation)).Should().ContainMatch("*category*");
    }
}
