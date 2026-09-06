# Pro Chat Security Requirements

## Authentication

- Passwords must never be stored in plaintext.
- Password reset tokens must expire and be single-use.
- Authentication endpoints should be rate limited.
- Sessions must use a strong server-side secret in production.
- Client applications must never contain server secrets.

## Realtime security

Socket connections must authenticate the user before accepting identity-sensitive events. Never trust a user ID supplied by an unauthenticated client.

## Messaging privacy

The production privacy model should be designed and documented before claiming end-to-end encryption. If E2EE is implemented, use a reviewed cryptographic protocol/library rather than inventing cryptography.

## Abuse protection

Implement account blocking, reporting, spam throttling, suspicious-login detection and moderation workflows before broad public launch.

## Data protection

Collect only data required to provide the service. Provide users with understandable privacy controls and appropriate export/deletion mechanisms. Review local legal requirements for every market in which the service is offered.

## Operational security

Use HTTPS/WSS, protected deployment secrets, encrypted backups where appropriate, dependency updates, monitoring and incident-response procedures.
