# Pro Chat Architecture

## Overview

Pro Chat is a web/PWA + Android-capable messaging client backed by a Fastify API and Socket.IO realtime service.

```text
Browser / Android
       |
       | HTTPS / WSS
       v
Fastify API + Socket.IO
       |
       +---- PostgreSQL / Neon
       |
       +---- Email / SMS providers
       |
       +---- WebAuthn / Passkeys
```

## Client

- React 19 + Vite
- Socket.IO client for realtime events
- Capacitor for Android packaging
- Browser WebAuthn APIs for passkeys
- Responsive chat layout with a fixed bottom composer

The production web client must use HTTPS. Camera, microphone, notifications and WebAuthn depend on secure browser contexts.

## Server

The server is implemented with Fastify and Socket.IO. Authentication endpoints live under `/api/auth/*`; health is exposed through `/health`.

The server validates authenticated sessions before protected REST and realtime operations. Passwords are never stored as plaintext.

## Database

Production deployments use PostgreSQL. Neon PostgreSQL is supported. Database credentials are deployment secrets and must never be committed to the repository or embedded in the web bundle.

## Passkeys

Passkey registration and login are handled by the server using WebAuthn verification. The browser side uses the Web Authentication API rather than attempting to load npm packages from `/node_modules` on GitHub Pages.

High-level flow:

1. Client requests registration or authentication options.
2. Server creates a short-lived WebAuthn challenge.
3. Browser calls the platform authenticator through WebAuthn.
4. Client sends the credential response to the server.
5. Server verifies the challenge, origin, RP ID and credential data.
6. Server creates or completes the authenticated session.

Never bypass WebAuthn verification in order to make a login succeed.

## Realtime messaging

Socket.IO provides authenticated realtime delivery and reconnection. REST endpoints remain the source of truth for operations that need durable server-side state.

## Deployment

The current documented deployment path uses GitHub Pages for the static web client and Northflank for the Fastify/Socket.IO backend.

Required production configuration includes:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
DATABASE_URL=<PostgreSQL connection string>
SESSION_SECRET=<random production secret>
WEB_ORIGIN=<HTTPS web origin>
```

Keep these values in deployment environment variables or secret stores. Do not put them in README files, source code or Git history.

## Repository layout

```text
apps/
  server/        Fastify + Socket.IO backend
  web/           React/Vite web client and Capacitor Android client

deploy/          Docker Compose and reverse-proxy configuration
docs/            Architecture, deployment and security documentation
.github/workflows/ CI and deployment workflows
```

## Security boundary

The application is not described as end-to-end encrypted until a complete, vetted E2EE protocol is implemented and reviewed. TLS protects network transport; authentication protects accounts; WebAuthn protects passkey authentication. These are separate security layers.
