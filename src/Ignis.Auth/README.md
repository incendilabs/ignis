# Ignis.Auth

OAuth 2.0 authorization server built on [OpenIddict](https://documentation.openiddict.com/) with MongoDB storage. Supports `client_credentials` and `authorization_code` (with mandatory PKCE + PAR) grant types.

## Configuration

```json
{
  "AuthSettings": {
    "ConnectionString": "mongodb://localhost:27017/ignis",
    "Clients": [
      {
        "ClientId": "my-backend",
        "ClientSecret": "my-secret",
        "DisplayName": "Backend Service",
        "AllowedGrantTypes": ["client_credentials"]
      },
      {
        "ClientId": "my-web-app",
        "ClientSecret": "web-secret",
        "DisplayName": "My Web App",
        "AllowedGrantTypes": ["authorization_code"],
        "RedirectUris": ["https://app.example.com/callback"],
        "PostLogoutRedirectUris": ["https://app.example.com"]
      }
    ],
    "Endpoints": {
      "LoginPath": "connect/login"
    },
    "Certificates": {
      "SigningCertificatePath": "certs/signing.pfx",
      "SigningCertificatePassword": "",
      "EncryptionCertificatePath": "certs/encryption.pfx",
      "EncryptionCertificatePassword": ""
    }
  }
}
```

All clients are confidential and require a `ClientSecret`. `AllowedGrantTypes` is required.

## Certificates

Development mode uses ephemeral auto-generated certificates. For production, generate PFX certificates:

```bash
mkdir -p certs
for NAME in signing encryption; do
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout certs/$NAME-key.pem -out certs/$NAME-cert.pem \
    -days 365 -subj "/CN=Ignis ${NAME^}"
  openssl pkcs12 -export -out certs/$NAME.pfx \
    -inkey certs/$NAME-key.pem -in certs/$NAME-cert.pem -passout pass:
done
rm certs/*.pem
```

The `certs/` directory is gitignored. Mount via volume or secrets in production.

## Client sync

Clients in `AuthSettings.Clients` are synced to MongoDB on startup — created, updated, or removed to match configuration.
