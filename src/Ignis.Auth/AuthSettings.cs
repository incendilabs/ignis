namespace Ignis.Auth;

public class AuthSettings
{
    public bool Enabled { get; set; }
    public string ConnectionString { get; set; } = "";
    public List<ClientDefinition> Clients { get; set; } = [];
    public AuthEndpointSettings Endpoints { get; set; } = new();
}

public class AuthEndpointSettings
{
    public string TokenEndpointPath { get; set; } = "connect/token";
}

public class ClientDefinition
{
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string DisplayName { get; set; } = "";
}
