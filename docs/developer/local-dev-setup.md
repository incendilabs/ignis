# Local Development Setup

This guide runs Ignis locally without a Cloudflare Tunnel:

| Service | Local URL |
| --- | --- |
| API | `https://localhost:5201` |
| FHIR API | `https://localhost:5201/fhir` |
| Web | `https://localhost:5202` |

Use a tunnel only when you specifically need a public URL. For normal OAuth, imports, resources, and operations testing, local HTTPS is less moving parts.

## 1. MongoDB

Start MongoDB with the `ignis` database user expected by `src/Ignis.Api/appsettings.local.json`.

```bash
docker exec -it mongodb mongosh -u admin -p admin --authenticationDatabase admin
```

Then create or update the app user:

```javascript
use ignis

db.createUser({
  user: "ignis",
  pwd: "ignis",
  roles: [{ role: "readWrite", db: "ignis" }]
})
```

If the user already exists:

```javascript
use ignis

db.updateUser("ignis", {
  pwd: "ignis",
  roles: [{ role: "readWrite", db: "ignis" }]
})
```

## 2. HTTPS Certificates

Trust the ASP.NET Core development certificate:

```bash
dotnet dev-certs https --trust
```

Export the same trusted certificate as PEM files for Vite:

```bash
mkdir -p certs
dotnet dev-certs https \
  --export-path certs/ignis-web-localhost.pem \
  --format Pem \
  --no-password
```

This writes:

```text
certs/ignis-web-localhost.pem
certs/ignis-web-localhost.key
```

`certs/` is gitignored because these files are local machine material.

To inspect the certificate:

```bash
openssl x509 -in certs/ignis-web-localhost.pem -noout -subject -ext subjectAltName
```

It should include `DNS:localhost`, `IP Address:127.0.0.1`, and `::1`.

## 3. API Configuration

`src/Ignis.Api/appsettings.local.json` should use the local HTTPS issuer and Web callback:

```json
{
  "AllowedHosts": "localhost",
  "AuthSettings": {
    "Issuer": "https://localhost:5201",
    "Clients": [
      {
        "ClientId": "ignis-web",
        "RedirectUris": ["https://localhost:5202/auth/callback"],
        "PostLogoutRedirectUris": ["https://localhost:5202"]
      }
    ]
  }
}
```

For local imports, also keep:

```json
"FeatureManagement": {
  "AllowImport": true
}
```

Start the API with the `https` launch profile so it listens on `https://localhost:5201`.

Verify discovery:

```bash
curl -k https://localhost:5201/.well-known/openid-configuration
```

## 4. Web Configuration

`src/Ignis.Web/.env` should use the same local URLs:

```env
IGNIS_WEB_FHIR_BASE_URL=https://localhost:5201/fhir
IGNIS_AUTH_ISSUER=https://localhost:5201
IGNIS_WEB_APP_URL=https://localhost:5202
```

The Web dev server reads these Vite/React Router settings from `.env`:

```env
IGNIS_WEB_DEV_PORT=5202
IGNIS_WEB_DEV_HTTPS=true
IGNIS_WEB_DEV_HTTPS_KEY=../../certs/ignis-web-localhost.key
IGNIS_WEB_DEV_HTTPS_CERT=../../certs/ignis-web-localhost.pem
IGNIS_WEB_DEV_ALLOWED_HOSTS=localhost,127.0.0.1
IGNIS_WEB_DEV_ALLOWED_ACTION_ORIGINS=localhost:5202,127.0.0.1:5202,[::1]:5202
```

Start Web from `src/Ignis.Web`:

```bash
npm run dev
```

Open:

```text
https://localhost:5202
```

Use `localhost` consistently. Avoid switching between `localhost`, `127.0.0.1`, and `::1` in the same login flow.

## 5. GitHub OAuth App

The GitHub OAuth App callback is the API external provider callback, not the Web callback.

Set GitHub's Authorization callback URL to:

```text
https://localhost:5201/connect/login-callback-github
```

The Web callback remains:

```text
https://localhost:5202/auth/callback
```

That callback is registered in `AuthSettings:Clients` for `ignis-web`.

## 6. Troubleshooting

If Web starts on HTTP, check:

```env
IGNIS_WEB_DEV_HTTPS=true
IGNIS_WEB_DEV_HTTPS_KEY=../../certs/ignis-web-localhost.key
IGNIS_WEB_DEV_HTTPS_CERT=../../certs/ignis-web-localhost.pem
```

If OAuth discovery fails, verify:

```bash
curl -k https://localhost:5201/.well-known/openid-configuration
```

If React Router returns `Bad Request` on import or other actions, the browser `Origin` and request `Host` do not match. Use `https://localhost:5202` consistently, or add the exact host to:

```env
IGNIS_WEB_DEV_ALLOWED_ACTION_ORIGINS=localhost:5202
```

If Node rejects the API certificate, do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` as the default. Prefer fixing the trusted dev certificate:

```bash
dotnet dev-certs https --clean
dotnet dev-certs https --trust
dotnet dev-certs https --export-path certs/ignis-web-localhost.pem --format Pem --no-password
```

Then restart both API and Web.

## Cloudflare Tunnel Variant

For public callback testing, switch only the URL values and allowed hosts:

```env
IGNIS_WEB_FHIR_BASE_URL=https://api.ignis-dev.example.com/fhir
IGNIS_AUTH_ISSUER=https://api.ignis-dev.example.com
IGNIS_WEB_APP_URL=https://web.ignis-dev.example.com
IGNIS_WEB_DEV_HTTPS=false
IGNIS_WEB_DEV_ALLOWED_HOSTS=web.ignis-dev.example.com
IGNIS_WEB_DEV_ALLOWED_ACTION_ORIGINS=web.ignis-dev.example.com
```

Then update `src/Ignis.Api/appsettings.local.json`:

```json
"Issuer": "https://api.ignis-dev.example.com",
"RedirectUris": ["https://web.ignis-dev.example.com/auth/callback"],
"PostLogoutRedirectUris": ["https://web.ignis-dev.example.com"]
```

Tunnel ingress:

```yaml
ingress:
  - hostname: api.ignis-dev.example.com
    service: http://localhost:5200
  - hostname: web.ignis-dev.example.com
    service: http://localhost:5202
  - service: http_status:404
```
