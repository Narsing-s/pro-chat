# Development Guide

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL for backend development
- Android Studio + Java 21 only when building the Android project locally

## Install

From the repository root:

```bash
npm install
```

## Run locally

Start the backend:

```bash
npm run dev -w apps/server
```

Start the web client in another terminal:

```bash
npm run dev -w apps/web
```

Typical development endpoints:

```text
Web: http://localhost:5173
API: http://localhost:3000
Health: http://localhost:3000/health
```

## Environment

Create local environment variables for the server. Do not commit `.env` files containing real credentials.

```text
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
DATABASE_URL=<local or development PostgreSQL URL>
SESSION_SECRET=<development-only random secret>
WEB_ORIGIN=http://localhost:5173
```

For the web client, use `VITE_API_URL` when the API is not on localhost.

## Build

```bash
npm run build -w apps/server
npm run build -w apps/web
```

## Authentication testing

Test the complete flow in this order:

1. Create account.
2. Log in with username, email or phone.
3. Open the home screen.
4. Search for another user.
5. Open a conversation.
6. Send and receive a message.
7. Log out.
8. Log in again.
9. Test forgot/reset password using a configured development mail provider.
10. Test passkey registration and login on HTTPS or localhost with a supported authenticator.

Do not disable authentication checks or hard-code successful responses to make a test pass.

## Realtime testing

Use the browser Network panel to verify Socket.IO connections. A healthy backend should return HTTP 200 from `/health` and establish a Socket.IO connection after authentication.

When debugging cross-origin requests, check:

- `WEB_ORIGIN` on the server.
- The frontend API origin.
- HTTPS/WSS usage in production.
- Browser CORS and cookie behavior.

## Android

The repository contains Capacitor Android configuration. CI generates/synchronizes the Android project before Gradle caching and build steps.

For local Android work, use Java 21 and Android Studio with an installed Android SDK.

## Code changes

Prefer small, focused commits. Keep security-sensitive changes isolated and document changes to authentication, sessions, WebAuthn, database migrations and deployment configuration.

Before pushing:

```bash
npm run build -w apps/server
npm run build -w apps/web
```

Also manually test the primary user journey whenever authentication, navigation, messaging or realtime code changes.
