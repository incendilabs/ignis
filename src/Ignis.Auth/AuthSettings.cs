namespace Ignis.Auth;

public class AuthSettings
{
    public bool Enabled { get; set; }
    public string ConnectionString { get; set; } = "";
    public List<ClientDefinition> Clients { get; set; } = [];
    public AuthEndpointSettings Endpoints { get; set; } = new();
    public AuthCertificateSettings Certificates { get; set; } = new();
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
    public string TokenEndpointPath { get; set; } = "connect/token";
}

public class ClientDefinition
{
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string DisplayName { get; set; } = "";
}
