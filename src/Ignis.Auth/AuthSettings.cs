/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Auth;

public class AuthSettings
{
    public string ConnectionString { get; set; } = "";
    /// <summary>
    /// Public-facing issuer URL for OpenID Connect metadata. Set this when
    /// the API runs behind a reverse proxy or tunnel that terminates TLS,
    /// so the discovery document advertises the external URL rather than
    /// the internal request URL. Leave empty to let OpenIddict derive it
    /// from the incoming request.
    /// </summary>
    public string? Issuer { get; set; }
    /// <summary>
    /// Issue smaller signed-only (JWS) access tokens instead of encrypted JWE.
    /// Keeps the BFF encrypted session cookie under the 4 KB browser limit, but 
    /// the token's claims become readable by any holder.
    /// </summary>
    public bool DisableAccessTokenEncryption { get; set; }

    /// <summary>
    /// Absolute refresh token lifetime (seconds) before a full re-login is required. Default 28800 (8 h);
    /// see https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
    /// </summary>
    public int RefreshTokenLifetimeSeconds { get; set; } = 28800;

    /// <summary>
    /// Grace window (seconds) where a redeemed refresh token is still accepted, tolerating
    /// concurrent refreshes from the same client. Null keeps OpenIddict's default.
    /// </summary>
    public int? RefreshTokenReuseLeewaySeconds { get; set; }
    public List<ClientDefinition> Clients { get; set; } = [];
    public AuthEndpointSettings Endpoints { get; set; } = new();
    public AuthCertificateSettings Certificates { get; set; } = new();
    public List<ExternalProviderSettings> ExternalProviders { get; set; } = [];
    public List<UserScopeAssignment> Users { get; set; } = [];
}

public class UserScopeAssignment
{
    /// <summary>Canonical subject identifier in the form <c>provider:provider-user-id</c>.</summary>
    public string Subject { get; set; } = "";
    public List<string> Scopes { get; set; } = [];
}

public class AuthCertificateSettings
{
    public string SigningCertificatePath { get; set; } = "";
    public string SigningCertificatePassword { get; set; } = "";
    public string EncryptionCertificatePath { get; set; } = "";
    public string EncryptionCertificatePassword { get; set; } = "";
}

public class AuthEndpointSettings
{
    public string LoginPath { get; set; } = "connect/login";
}

public class ExternalProviderSettings
{
    /// <summary>Display name and authentication scheme identifier.</summary>
    public required string Name { get; init; }
    public required ExternalProviderType Type { get; init; }
    public required string ClientId { get; init; }
    public required string ClientSecret { get; init; }
    /// <summary>OIDC authority URL. Required when Type is "OIDC".</summary>
    public string? Authority { get; set; }
}

public enum ExternalProviderType
{
    GitHub,
    OIDC,
}

/// <summary>
/// Well-known OAuth endpoint configuration for built-in provider types.
/// </summary>
public static class WellKnownOAuthEndpoints
{
    public static readonly OAuthEndpoints GitHub = new(
        AuthorizationEndpoint: "https://github.com/login/oauth/authorize",
        TokenEndpoint: "https://github.com/login/oauth/access_token",
        UserInformationEndpoint: "https://api.github.com/user");
}

public record OAuthEndpoints(
    string AuthorizationEndpoint,
    string TokenEndpoint,
    string UserInformationEndpoint);

public class ClientDefinition
{
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public List<string> AllowedGrantTypes { get; set; } = [];
    public List<string> RedirectUris { get; set; } = [];
    public List<string> PostLogoutRedirectUris { get; set; } = [];
    public List<string> AllowedScopes { get; set; } = [];
}
