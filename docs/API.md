# Pro Chat API Overview

The backend is a Fastify service. Protected endpoints require an authenticated application session. Realtime messaging is provided through Socket.IO.

## Health

```text
GET /health
```

Use this endpoint for deployment health checks. A successful health response confirms that the process is running and the configured database is reachable.

## Authentication

The authentication surface is under `/api/auth` and includes account/session operations such as:

- registration
- login
- logout
- logout all sessions
- password reset request
- password reset completion
- password change
- account/profile credential changes
- MFA/TOTP foundations
- passkey/WebAuthn registration and login
- trusted-device/device-approval foundations

Authentication should be treated as a security boundary. Client-side UI state must never be considered proof that a user is authenticated.

## Users

The application provides user lookup/profile operations used by chat discovery. User search results must expose only fields intended for other users to see.

Do not expose password hashes, session hashes, reset tokens, MFA secrets or internal security metadata through user endpoints.

## Messages

A protected chat-history route is available in the form:

```text
GET /api/messages/:chatId
```

The server must verify that the authenticated user is a participant in the requested chat before returning messages.

Message mutations must similarly enforce ownership/authorization. Editing or deleting a message must never rely only on a message ID supplied by the browser.

## Realtime

Socket.IO is used for realtime delivery. The client authenticates the socket using the application's authenticated session mechanism.

The server must verify authentication during socket connection and authorization for each chat/message operation. Realtime transport is not a substitute for database authorization.

Production clients should connect through HTTPS/WSS-compatible public origins.

## Error handling

API clients should expect normal HTTP status codes for failures. Do not expose stack traces, database errors, secrets or internal implementation details to end users.

Authentication failures should use generic messages where revealing whether an account exists would create an enumeration risk.

## Compatibility rule

When changing an API contract:

1. Update the backend implementation.
2. Update the web/mobile client.
3. Update this document.
4. Add or update tests.
5. Document breaking changes before release.

The API is under active development; this document intentionally describes the stable architectural contract rather than pretending every roadmap feature is production-complete.