/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Firely.Fhir.Packages;

using FluentAssertions;

using Hl7.Fhir.Model;
using Hl7.Fhir.Specification.Source;
using Hl7.Fhir.Specification.Terminology;

using Xunit;

// Avoid clash with Hl7.Fhir.Model.Task
using Task = System.Threading.Tasks.Task;

namespace Ignis.Terminology.Tests;

/// <summary>Builds a terminology service from the staged R4 core package once for the test class.</summary>
public sealed class R4CoreTerminologyFixture
{
    public IValueSetExpansionService Service { get; }

    public R4CoreTerminologyFixture()
    {
        var directory = Path.Combine(AppContext.BaseDirectory, "fhir-packages");
        var packages = Directory.GetFiles(directory, "*.tgz");
        IAsyncResourceResolver core = new FhirPackageSource(ModelInfo.ModelInspector, packages);
        ITerminologyService terminology = LocalTerminologyService.CreateDefaultForCore(core);
        Service = new ValueSetExpansionService(terminology);
    }
}

public class ValueSetExpansionServiceTests(R4CoreTerminologyFixture fixture)
    : IClassFixture<R4CoreTerminologyFixture>
{
    [Fact]
    public async Task Expand_CoreValueSet_ByUrl_ReturnsItsCodes()
    {
        var parameters = new ExpandParameters()
            .WithValueSet("http://hl7.org/fhir/ValueSet/administrative-gender", null, null, null, null);

        var expanded = await fixture.Service.ExpandAsync(parameters);

        expanded.Expansion.Should().NotBeNull();
        var codes = expanded.Expansion!.Contains.Select(c => c.Code).ToList();
        codes.Should().Contain("male").And.Contain("female").And.Contain("other").And.Contain("unknown");
    }
}
