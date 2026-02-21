# ADR-0001: Authentication and Authorization Architecture

## Status

Accepted

## Context

Ignis is an experimental FHIR-compatible API server that needs an authentication and authorization layer to serve two use cases:

1. **System/maintenance access** — Internal tooling and administrative operations require securing API endpoints with role-based access control mapped to authenticated users.
2. **SMART app alignment** — We are considering future support for [SMART App Launch Framework](https://hl7.org/fhir/smart-app-launch/), and the authentication architecture should be aligned with that in mind from the start.

Ignis is **not** an Identity Provider (IdP). User identities are managed by external providers, starting with GitHub, with the ability to add more providers later.

### Requirements

- Support two grant types: **Client Credentials** (machine-to-machine) and **Authorization Code with refresh tokens** (user-facing apps)
- Federate to external identity providers (GitHub initially, extensible to others)
- Map authenticated users to application roles
- Pushed Authorization Requests (RFC 9126)
- Auth code flow will Require PKCE (RFC 7636)

## Discussion

### Alternatives Considered

1. **OpenIddict (self-hosted authorization server, federated IdP)**
   - Acts as an authorization server that issues its own tokens, while delegating user authentication to external providers
   - Supports Client Credentials, Authorization Code, refresh tokens, PAR, PKCE. Seems to be missing DPoP support.
   - Native MongoDB store via `OpenIddict.MongoDb`
   - Open source (Apache 2.0), actively maintained
   - Pros: Full control over token contents and claims, no external dependency at runtime, extensible
   - Cons: more surface area to maintain and secure correctly, medium quality documentation

2. **Duende IdentityServer**
   - Feature-complete, supports all required flows and security extensions
   - Pros: Battle-tested, excellent documentation, good SMART on FHIR story
   - Cons: Commercial license required for production use (cost scales with usage). Not ideal for an open-source project.

3. **Keycloak (self-hosted)**
   - Full-featured open-source IdP and authorization server
   - Pros: Mature, wide protocol support, admin UI
   - Cons: Significant operational overhead (JVM, separate deployment), overkill for current scale, complex to embed in .NET application lifecycle

4. **Managed identity platform (Auth0, Okta, Microsoft Entra)**
   - Pros: No infrastructure to maintain, enterprise-grade security
   - Cons: External runtime dependency, cost, less control over SMART on FHIR customization, license model  not a good fit for an open-source project

### Rationale

OpenIddict is chosen because:

- It satisfies all required grant types and security extensions (PAR, PKCE) within a single open-source library
- It acts as an authorization server fronting external IdPs, which matches the requirement of not being an IdP ourselves while still issuing application-scoped tokens with role claims
- `OpenIddict.MongoDb` avoids introducing new infrastructure
- The SMART on FHIR use case is achievable by extending the Authorization Code flow with FHIR-specific scopes and launch context.
- Full control over token claims enables role mapping from external identity attributes (e.g., GitHub org membership)

### Key Design Decisions

#### PAR and PKCE as hard requirements from day one

PAR mitigates authorization request tampering by submitting parameters directly to the server before the browser redirect. PKCE prevents authorization code interception attacks. 

#### DPoP as a goal

DPoP (RFC 9449) binds access tokens to a client-controlled asymmetric key and requires a signed proof per request. While OpenIddict does not provide full built-in DPoP support, its extensibility model allows implementing DPoP validation and token binding. We will not support public clients but DPoP is still valuable for mitigating token replay attacks in case of token leakage.

#### Role mapping via claims transformation

GitHub (and future providers) supply identity claims (e.g., user id, org membership). A claims transformation step maps these to application roles stored in MongoDB. This keeps authorization logic inside Ignis rather than relying on IdP-specific role structures.

#### SMART on FHIR readiness

The Authorization Code flow, refresh tokens, PAR, and PKCE are all prerequisites for SMART App Launch. If SMART support is implemented, the auth architecture could be used as the foundation.

## Decision

We will implement an OAuth 2.0 / OIDC authorization server using **OpenIddict**, embedded in the Ignis API, that:

- Issues its own short-lived access tokens and refresh tokens
- Delegates user authentication to external identity providers via ASP.NET Core external authentication (GitHub first, extensible)
- Maps external identity claims to application roles stored in MongoDB
- Supports **Client Credentials Flow** for machine-to-machine access
- Supports **Authorization Code Flow** with PKCE and PAR for user-facing access
- Is designed to be aligned with the SMART App Launch Framework

The implementation i started, and lives in the `Ignis.Auth` project and is feature-flagged via `AuthSettings:Enabled`, allowing installations without authentication requirements to run without it.

## Consequences

### Positive

- Full control over token issuance and claims — role mapping, FHIR context, and future SMART scopes are all manageable without framework changes
- Security baseline (PAR + PKCE) is enforced from day one
- No external runtime dependency for authentication — Ignis is self-contained
- Open source with no licensing cost

### Negative

- We own an authorization server — there might be security implications, even if this is clearly marked as an experimental implementation.
- External IdP federation adds complexity
- Certificate management (signing + encryption) is required in production

## References

- [OpenIddict documentation](https://documentation.openiddict.com/)
- [RFC 6749 – OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7636 – PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 9126 – Pushed Authorization Requests (PAR)](https://datatracker.ietf.org/doc/html/rfc9126)
- [RFC 9449 – DPoP](https://datatracker.ietf.org/doc/html/rfc9449)
- [OAuth 2.1 (draft)](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)
- [SMART App Launch Framework](https://hl7.org/fhir/smart-app-launch/)
