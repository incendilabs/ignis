# GitHub Authentication Setup

Guide for configuring GitHub as an external identity provider for the authorization code flow.

## Prerequisites

- A running Ignis instance with auth enabled (`AuthSettings:ConnectionString` configured)
- A GitHub account with permission to create OAuth Apps

## 1. Create a GitHub OAuth App

Go to [GitHub Developer Settings](https://github.com/settings/developers) and click **New OAuth App**.

| Field                      | Value                                                  |
| -------------------------- | ------------------------------------------------------ |
| Application name           | Ignis (or your preferred name)                         |
| Homepage URL               | `https://localhost:5201` (or your domain)              |
| Authorization callback URL | `https://localhost:5201/connect/login-callback-github` |

After creating the app, generate a client secret and note both the **Client ID** and **Client Secret**.

## 2. Configure credentials

Use user-secrets for local development:

```bash
dotnet user-secrets set "AuthSettings:ExternalProviders:0:Name" "GitHub" --project src/Ignis.Api
dotnet user-secrets set "AuthSettings:ExternalProviders:0:Type" "GitHub" --project src/Ignis.Api
dotnet user-secrets set "AuthSettings:ExternalProviders:0:ClientId" "<client-id>" --project src/Ignis.Api
dotnet user-secrets set "AuthSettings:ExternalProviders:0:ClientSecret" "<client-secret>" --project src/Ignis.Api
```

Or in `appsettings.json` (do not commit secrets):

```json
"AuthSettings": {
  "ExternalProviders": [
    {
      "Name": "GitHub",
      "Type": "GitHub",
      "ClientId": "<client-id>",
      "ClientSecret": "<client-secret>"
    }
  ]
}
```

For production, use environment variables:

```bash
AuthSettings__ExternalProviders__0__Name=GitHub
AuthSettings__ExternalProviders__0__Type=GitHub
AuthSettings__ExternalProviders__0__ClientId=<client-id>
AuthSettings__ExternalProviders__0__ClientSecret=<client-secret>
```

## 3. Test the login flow

Start the application and navigate to:

```text
https://localhost:5201/connect/login?provider=GitHub
```

This should redirect you to GitHub for authentication. After authorizing, you are redirected back and a session cookie is issued.

## How it works

The full authorization code flow with GitHub login:

1. Client initiates PKCE + PAR flow, browser arrives at `/connect/authorize`
2. No session cookie exists, so the user is redirected to `/connect/login?provider=GitHub`
3. The login endpoint triggers a GitHub OAuth challenge
4. User authenticates on GitHub, GitHub redirects to `/connect/login-callback-github`
5. ASP.NET Core exchanges the code, fetches user info from GitHub's API, and issues a session cookie
6. User is redirected back to `/connect/authorize`, which now finds a valid session and issues an authorization code
7. Client exchanges the authorization code for an access token at `/connect/token`

## Mapped claims

The following GitHub user fields are mapped to session claims:

| GitHub field  | Claim type          | Description                              |
| ------------- | ------------------- | ---------------------------------------- |
| `id`          | `NameIdentifier`    | GitHub user ID (becomes `sub` in tokens) |
| `name`        | `Name`              | Display name                             |
| `avatar_url`  | `urn:github:avatar` | Profile picture URL                      |
