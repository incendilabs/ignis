using FluentAssertions;

using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace Ignis.Api.Tests.Authorization;

public class ScopeAuthorizationPolicyProviderTests
{
    private static ScopeAuthorizationPolicyProvider CreateProvider() =>
        new(Options.Create(new AuthorizationOptions()));

    [Fact]
    public async Task GetPolicy_WithScopePrefix_BuildsPolicyWithMatchingRequirement()
    {
        var policy = await CreateProvider()
            .GetPolicyAsync("scope:maintenance/database.read");

        policy.Should().NotBeNull();
        policy!.Requirements.OfType<ScopeRequirement>()
            .Should().ContainSingle()
            .Which.Scope.Should().Be("maintenance/database.read");
    }

    [Fact]
    public async Task GetPolicy_WithSmartFhirScope_PassesStructuredNameThrough()
    {
        // Documents that the provider does no parsing of scope structure —
        // SMART on FHIR scopes flow through to the handler verbatim.
        var policy = await CreateProvider()
            .GetPolicyAsync("scope:patient/Observation.read");

        policy!.Requirements.OfType<ScopeRequirement>()
            .Single().Scope.Should().Be("patient/Observation.read");
    }

    [Fact]
    public async Task GetPolicy_WithoutScopePrefix_FallsThroughToDefaultProvider()
    {
        // The default provider returns null for unknown policy names —
        // proves we don't accidentally swallow them.
        var policy = await CreateProvider()
            .GetPolicyAsync("SomeUnregisteredPolicy");

        policy.Should().BeNull();
    }

    [Theory]
    [InlineData("scope:")]
    [InlineData("scope:   ")]
    public async Task GetPolicy_WithEmptyScopeSuffix_FallsThroughInsteadOfThrowing(string policyName)
    {
        // "scope:" with no real suffix is malformed — fall through to the
        // default provider so the developer gets ASP.NET Core's standard
        // "policy not found" error instead of an exception from
        // ScopeRequirement's constructor.
        var policy = await CreateProvider().GetPolicyAsync(policyName);

        policy.Should().BeNull();
    }
}
