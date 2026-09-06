# Pro Chat Documentation

Pro Chat is a global-first communication platform under active development. The project is designed around reliable authentication, realtime messaging, multi-device access and a privacy-first product model.

## Documentation map

- [Architecture](ARCHITECTURE.md) — application components, request flow, realtime flow and security boundaries.
- [Development](DEVELOPMENT.md) — local setup, environment variables and development workflow.
- [Testing](TESTING.md) — smoke tests, authentication tests and release checks.
- [Passkeys](PASSKEYS.md) — WebAuthn/passkey registration and login behavior.
- [Security](SECURITY.md) — authentication, sessions, WebAuthn, realtime and operational security requirements.
- [Remote deployment](REMOTE-DEPLOYMENT.md) — remote Docker deployment configuration.
- [Northflank deployment](NORTHFLANK-DEPLOYMENT.md) — current backend hosting setup.

## Product direction

The roadmap targets a polished communication platform covering:

- Private 1:1 messaging
- Group conversations and administration
- Voice and video calling
- Media, files, links, voice messages and reactions
- Presence, delivery/read states and offline delivery
- Multi-device sessions
- Profiles, privacy controls, blocking and reporting
- Communities and broadcast channels
- Polls, announcements and rich message actions
- Search, pinned/starred messages and chat organization
- Business and creator capabilities
- Notifications, deep links and reliable reconnect behavior
- Accessibility, localization and international phone-number support
- Strong authentication, account recovery and abuse prevention

Feature parity with established messengers is a baseline, not a copying exercise. Pro Chat should keep its own product identity and add useful differentiators.

## Current core flow

The first production-critical path is:

`Create Account → Login → Home → New Chat → Send Message → Receive Message`

After this path is stable, the next priorities are media, voice messages, groups, notifications and calls, followed by AI assistance, translation, events, bots and advanced privacy features.

## Architecture at a glance

```text
Web / Android / future clients
          │ HTTPS / WSS
          ▼
   Fastify + Socket.IO API
          │
          ├── Authentication / sessions / WebAuthn
          ├── Users / chats / messages
          ├── Realtime events
          └── Upload / notification integrations
          │
          ▼
      PostgreSQL / Neon
```

The browser frontend is a Vite/React application. Android uses the web client through Capacitor. The backend is a Node.js/Fastify service and Socket.IO provides authenticated realtime transport.

## Production deployment model

- **Frontend:** GitHub Pages or another HTTPS static host.
- **Backend:** Northflank or another Node/Docker-compatible service.
- **Database:** Neon PostgreSQL.
- **Realtime:** Socket.IO over HTTPS/WSS.
- **Secrets:** deployment-provider secret/runtime-variable storage only.

The frontend must point to the public backend origin through the build-time `VITE_API_URL` configuration. The backend must allow the exact frontend origin through `WEB_ORIGIN`.

Do not treat the backend health endpoint as proof that the frontend is configured correctly. `/health` proves the service and database are reachable; authentication and realtime smoke tests prove the end-to-end application path.

## Global availability

### Android

The preferred public distribution path is Google Play. Production releases should be signed Android App Bundles (AAB). Debug APKs are for testing only.

### Web

Keep a production HTTPS web client available so users can access Pro Chat without installing an Android package. Browser APIs such as WebAuthn, camera, microphone and notifications require secure contexts in production.

### iOS and other platforms

Add platform-specific clients after the shared API, authentication, realtime protocol, storage model and privacy/security model are stable.

## Authentication

Registration collects email, phone number, username, password and confirmation. Login accepts username, email or phone. The backend owns credential verification and session creation.

Account security also includes password reset, password changes, account/session controls, MFA foundations, trusted-device/device-approval foundations and WebAuthn/passkey support.

Password-reset and verification messages must be delivered by the configured production notification provider. Never bypass verification or reset protections just to make a UI flow appear successful.

## Passkeys

Passkeys use the browser's native WebAuthn credential APIs through the Pro Chat client. The browser should never load authentication code from an arbitrary `/node_modules` path on a static deployment. The passkey implementation must validate challenges, origin, RP ID and credential ownership on the server.

See [Passkeys](PASSKEYS.md) and [Security](SECURITY.md).

## Release policy

Every release should have:

1. A unique version/build number.
2. Automated web/server/Android builds.
3. Automated tests and type/build checks.
4. A signed release artifact where applicable.
5. Release notes.
6. SHA-256 checksums for direct-download artifacts.
7. A rollback plan.
8. A documented list of breaking changes.

## Security baseline

- Never commit production secrets, database URLs or session secrets.
- Use HTTPS/WSS in production.
- Store passwords only as strong salted password hashes.
- Rate-limit authentication and recovery endpoints.
- Use generic recovery responses to reduce account enumeration.
- Validate authorization for every protected resource.
- Protect realtime sockets with authenticated sessions.
- Keep WebAuthn challenge/origin/RP validation server-side.
- Do not claim end-to-end encryption until a real E2EE protocol is implemented and reviewed.
- Add abuse reporting, blocking and moderation before broad public launch.

## Design principles

1. **Fast** — common actions should require minimal taps.
2. **Familiar** — messaging conventions should feel natural.
3. **Distinctive** — maintain a recognizable Pro Chat visual system.
4. **Private** — privacy controls should be understandable.
5. **Reliable** — reconnect and offline states should recover automatically.
6. **Accessible** — support keyboard navigation, screen readers, large text and contrast.
7. **Global** — avoid region-specific assumptions about numbers, dates, time zones and language.

## Contribution

Read [CONTRIBUTING.md](../CONTRIBUTING.md) before changing authentication, sessions, realtime transport, deployment or security-sensitive code. GitHub recommends keeping a clear README, contribution guidance and security policy so contributors can understand the project and work safely. citeturn0search0turn0search1

## Documentation rule

Keep the root README focused on project orientation and quick start. Put detailed operational and engineering material in `docs/`, so the repository remains easy to navigate. This follows GitHub's guidance that READMEs should help people understand, start and get help with a project while longer material belongs in dedicated documentation. citeturn0search2
