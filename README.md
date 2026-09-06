# Pro Chat

A global-first, privacy-focused messaging platform for web and Android, built around reliable authentication, realtime messaging and a progressively expanding communication stack.

> **Current status:** active development. The repository is not yet a finished WhatsApp replacement or a production E2EE messenger.

## What Pro Chat includes today

- Responsive web messenger UI
- Account registration and login using username, email or phone
- Password recovery foundations
- Authenticated HTTP and Socket.IO realtime sessions
- PostgreSQL/Neon backend support
- Realtime messaging foundation
- Delivery/read indicators
- Voice/video calling foundation with WebRTC signaling
- Web/PWA installation support
- Capacitor Android build support
- Passkey/WebAuthn registration and authentication
- Docker deployment configuration
- GitHub Actions build/deployment workflows
- Northflank-compatible backend deployment
- GitHub Pages-compatible static web deployment
- Responsive chat composer fixed to the bottom of conversations

## Architecture

```text
Web / Android
     |
 HTTPS / WSS
     v
Fastify + Socket.IO
     |
 PostgreSQL / Neon
```

See [Architecture](docs/ARCHITECTURE.md) for the current design and security boundaries.

## Repository structure

```text
apps/server/              Fastify + Socket.IO backend
apps/web/                 React/Vite web client + Capacitor integration
deploy/                   Docker and reverse-proxy configuration
docs/                     Architecture, development and deployment guides
.github/workflows/        CI and deployment workflows
```

## Quick start

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev -w apps/server
npm run dev -w apps/web
```

Development URLs:

```text
Web:    http://localhost:5173
API:    http://localhost:3000
Health: http://localhost:3000/health
```

For a separate API origin, configure the web build with `VITE_API_URL`.

## Production configuration

The backend expects deployment environment variables similar to:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
DATABASE_URL=<PostgreSQL connection string>
SESSION_SECRET=<random production secret>
WEB_ORIGIN=<HTTPS frontend origin>
```

**Never commit real values.** Store credentials and secrets in the hosting provider's secret/environment-variable system.

## Passkeys

Passkeys use WebAuthn. The browser side uses the platform Web Authentication API instead of loading an npm package from `/node_modules` on GitHub Pages.

The server must validate the WebAuthn challenge, relying-party configuration, origin and credential response. Do not bypass verification to work around browser or deployment errors.

Passkeys require a secure browser context such as HTTPS in production.

## Deployment

The current documented setup separates the static web client from the backend:

- **Web:** GitHub Pages or another HTTPS static host.
- **Backend:** Northflank or another service that supports long-running HTTP and WebSocket workloads.
- **Database:** PostgreSQL/Neon.

Read [Northflank Deployment](docs/NORTHFLANK-DEPLOYMENT.md) and [Remote Deployment](docs/REMOTE-DEPLOYMENT.md) for deployment-specific configuration.

GitHub Pages cannot run the Fastify API or Socket.IO backend; it only serves the frontend assets.

## Security

Security-sensitive behavior is documented in [SECURITY.md](SECURITY.md) and [docs/SECURITY.md](docs/SECURITY.md).

Do not put database URLs, session secrets, provider credentials or private keys into frontend code, README files or Git history. If a production secret is exposed, rotate it.

Pro Chat should not be advertised as end-to-end encrypted until a complete, vetted E2EE protocol has been implemented and reviewed.

## Development and testing

See [Development Guide](docs/DEVELOPMENT.md) for local setup, authentication testing, realtime debugging and Android development.

For every authentication or messaging change, verify the core journey:

```text
Create account
    -> Login
    -> Home
    -> New chat
    -> Send message
    -> Receive message
```

## Roadmap

1. Strong account/device/session management
2. Reliable multi-device synchronization
3. Groups and communities
4. Media and file sharing
5. Push notifications
6. Voice/video calling hardening
7. Privacy controls, chat lock and abuse prevention
8. Translation and accessibility
9. Events, polls, channels and creator/business features
10. Vetted end-to-end encryption
11. AI-assisted messaging and other differentiating features

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Security Guide](docs/SECURITY.md)
- [Northflank Deployment](docs/NORTHFLANK-DEPLOYMENT.md)
- [Remote Deployment](docs/REMOTE-DEPLOYMENT.md)
- [Project Documentation](docs/README.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
