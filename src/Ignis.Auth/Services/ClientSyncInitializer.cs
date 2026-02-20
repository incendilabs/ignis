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
                configuredIds.Add(client.ClientId);
            await UpsertClientAsync(client, cancellationToken);
        }

        await RemoveOrphanedClientsAsync(configuredIds, cancellationToken);
    }

    internal bool ValidateClientSettings(ClientDefinition client)
    {
        if (string.IsNullOrWhiteSpace(client.ClientId) || string.IsNullOrWhiteSpace(client.ClientSecret))
        {
            _logger.LogWarning("Skipping OAuth client with missing ClientId or ClientSecret.");
            return false;
        }

        return true;
    }

    internal async Task UpsertClientAsync(ClientDefinition client, CancellationToken cancellationToken)
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

    internal OpenIddictApplicationDescriptor BuildDescriptor(ClientDefinition client)
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
                    throw new NotImplementedException(
                        $"Grant type '{GrantTypes.AuthorizationCode}' is not yet supported.");

                default:
                    _logger.LogWarning(
                        "Unsupported grant type '{GrantType}' for client {ClientId}.",
                        grantType, client.ClientId);
                    break;
            }
        }

        return descriptor;
    }

    internal async Task RemoveOrphanedClientsAsync(
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
