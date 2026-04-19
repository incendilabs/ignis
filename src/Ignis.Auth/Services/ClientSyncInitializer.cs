/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using OpenIddict.Abstractions;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Ignis.Auth.Services;

public class ClientSyncInitializer
{
    private readonly IOpenIddictApplicationManager _manager;
    private readonly AuthSettings _settings;
    private readonly ILogger<ClientSyncInitializer> _logger;

    public ClientSyncInitializer(
        IOpenIddictApplicationManager manager,
        IOptions<AuthSettings> settings,
        ILogger<ClientSyncInitializer> logger)
    {
        _manager = manager;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var configuredIds = new HashSet<string>();

        foreach (var client in _settings.Clients)
        {
            if (ValidateClientSettings(client))
            {
                configuredIds.Add(client.ClientId);
                await UpsertClientAsync(client, cancellationToken);
            }
        }

        await RemoveOrphanedClientsAsync(configuredIds, cancellationToken);
    }

    private bool ValidateClientSettings(ClientDefinition client)
    {
        if (string.IsNullOrWhiteSpace(client.ClientId) || string.IsNullOrWhiteSpace(client.ClientSecret))
        {
            _logger.LogWarning("Skipping OAuth client with missing ClientId or ClientSecret.");
            return false;
        }

        return true;
    }

    private async Task UpsertClientAsync(ClientDefinition client, CancellationToken cancellationToken)
    {
        var descriptor = BuildDescriptor(client);

        var existing = await _manager.FindByClientIdAsync(client.ClientId, cancellationToken);
        if (existing != null)
        {
            await _manager.UpdateAsync(existing, descriptor, cancellationToken);
            _logger.LogInformation("Updated OAuth client {ClientId}.", client.ClientId);
        }
        else
        {
            await _manager.CreateAsync(descriptor, cancellationToken);
            _logger.LogInformation("Created OAuth client {ClientId}.", client.ClientId);
        }
    }

    private OpenIddictApplicationDescriptor BuildDescriptor(ClientDefinition client)
    {
        if (client.AllowedGrantTypes.Count == 0)
        {
            _logger.LogWarning(
                "OAuth client {ClientId} has no AllowedGrantTypes configured — it will not be usable.",
                client.ClientId);
        }

        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = client.ClientId,
            ClientSecret = client.ClientSecret,
            ClientType = ClientTypes.Confidential,
            DisplayName = client.DisplayName.Length > 0 ? client.DisplayName : client.ClientId,
            Permissions =
            {
                Permissions.Endpoints.Token,
            }
        };

        foreach (var grantType in client.AllowedGrantTypes)
        {
            switch (grantType)
            {
                case GrantTypes.ClientCredentials:
                    descriptor.Permissions.Add(Permissions.GrantTypes.ClientCredentials);
                    break;

                case GrantTypes.AuthorizationCode:
                    if (client.RedirectUris.Count == 0)
                    {
                        _logger.LogWarning(
                            "Client {ClientId} allows authorization_code but has no RedirectUris configured – skipping auth code permissions.",
                            client.ClientId);
                        break;
                    }

                    descriptor.Permissions.Add(Permissions.Endpoints.Authorization);
                    descriptor.Permissions.Add(Permissions.Endpoints.PushedAuthorization);
                    descriptor.Permissions.Add(Permissions.GrantTypes.AuthorizationCode);
                    descriptor.Permissions.Add(Permissions.ResponseTypes.Code);

                    descriptor.Requirements.Add(Requirements.Features.ProofKeyForCodeExchange);
                    descriptor.Requirements.Add(Requirements.Features.PushedAuthorizationRequests);

                    foreach (var uri in client.RedirectUris)
                        descriptor.RedirectUris.Add(new Uri(uri));

                    if (client.PostLogoutRedirectUris.Count > 0)
                    {
                        descriptor.Permissions.Add(Permissions.Endpoints.EndSession);
                        foreach (var uri in client.PostLogoutRedirectUris)
                            descriptor.PostLogoutRedirectUris.Add(new Uri(uri));
                    }
                    break;

                default:
                    _logger.LogWarning(
                        "Unsupported grant type '{GrantType}' for client {ClientId}.",
                        grantType, client.ClientId);
                    break;
            }
        }

        foreach (var scope in client.AllowedScopes)
            descriptor.Permissions.Add(Permissions.Prefixes.Scope + scope);

        return descriptor;
    }

    private async Task RemoveOrphanedClientsAsync(
        HashSet<string> configuredIds, CancellationToken cancellationToken)
    {
        await foreach (var app in _manager.ListAsync(cancellationToken: cancellationToken))
        {
            var clientId = await _manager.GetClientIdAsync(app, cancellationToken);
            if (clientId != null && !configuredIds.Contains(clientId))
            {
                await _manager.DeleteAsync(app, cancellationToken);
                _logger.LogInformation("Removed OAuth client {ClientId}.", clientId);
            }
        }
    }
}
