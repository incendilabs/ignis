# Ignis.Auth

OAuth 2.0 token service for Ignis, built on [OpenIddict](https://documentation.openiddict.com/) with MongoDB storage.

Currently supports the `client_credentials` grant type.

## Configuration

```json
{
  "AuthSettings": {
    "Enabled": true,
    "ConnectionString": "mongodb://localhost:27017/ignis",
    "Clients": [
      {
        "ClientId": "my-client",
        "ClientSecret": "my-secret",
        "DisplayName": "My Client"
      }
    ],
    "Endpoints": {
      "TokenEndpointPath": "connect/token"
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

## Certificates

OpenIddict requires a signing certificate and an encryption certificate for token generation and validation.

### Development

In development mode, OpenIddict automatically generates ephemeral development certificates. No configuration needed.

### Production

Generate self-signed PFX certificates for signing and encryption:

```bash
mkdir -p certs

# Signing certificate
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout certs/signing-key.pem -out certs/signing-cert.pem \
  -days 365 -subj "/CN=Ignis Token Signing"
openssl pkcs12 -export -out certs/signing.pfx \
  -inkey certs/signing-key.pem -in certs/signing-cert.pem \
  -passout pass:

# Encryption certificate
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout certs/encryption-key.pem -out certs/encryption-cert.pem \
  -days 365 -subj "/CN=Ignis Token Encryption"
openssl pkcs12 -export -out certs/encryption.pfx \
  -inkey certs/encryption-key.pem -in certs/encryption-cert.pem \
  -passout pass:

# Clean up PEM files
rm certs/*.pem
```

The `certs/` directory is gitignored. Mount certificates via volume or secrets in production.

## Client sync

Clients defined in `AuthSettings.Clients` are synced to MongoDB on startup:

- New clients are created
- Existing clients are updated (secret, display name)
- Clients not in config are removed

## Usage

```bash
curl -X POST https://localhost:5201/connect/token \
  -d grant_type=client_credentials \
  -d client_id=my-client \
  -d client_secret=my-secret
```
