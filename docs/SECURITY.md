# Pro Chat Security Requirements

## Authentication

- Passwords must never be stored in plaintext.
- Password reset tokens must expire and be single-use.
- Authentication endpoints should be rate limited.
- Sessions must use a strong server-side secret in production.
- Client applications must never contain server secrets.
- Login, registration and recovery must be verified by the server; never add client-side authentication bypasses.

## Passkeys / WebAuthn

- Validate the WebAuthn challenge server-side.
- Validate the expected origin and relying-party ID.
- Validate credential data and authenticator assertions on the server.
- Keep WebAuthn challenges short-lived.
- Never skip verification to work around browser or deployment errors.
- Production WebAuthn requires a secure context such as HTTPS.

The browser client uses the platform Web Authentication API. It must not assume `/node_modules` is directly available on static hosts such as GitHub Pages.

## Realtime security

Socket connections must authenticate the user before accepting identity-sensitive events. Never trust a user ID supplied by an unauthenticated client.

## Messaging privacy

TLS protects transport; it does not by itself provide end-to-end encryption. Do not claim E2EE until the complete protocol is implemented with a vetted cryptographic library/protocol and appropriate security review.

## Abuse protection

Implement account blocking, reporting, spam throttling, suspicious-login detection, rate limits and moderation workflows before broad public launch.

## Data protection

Collect only data required to provide the service. Provide users with understandable privacy controls and appropriate export/deletion mechanisms. Review local legal requirements for every market in which the service is offered.

## Operational security

Use HTTPS/WSS, protected deployment secrets, encrypted backups where appropriate, dependency updates, monitoring and incident-response procedures.

If a production secret is exposed, rotate it immediately and invalidate affected sessions where appropriate. Never place real database URLs, API keys, SMTP credentials or session secrets in documentation or source control.
