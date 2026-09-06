# Pro Chat

A clean, offline-first messaging foundation for web and Android.

## What is included

- Responsive messenger UI
- Local-first message storage using browser storage
- Automatic realtime reconnect with Socket.IO
- Authenticated HTTP and realtime sessions
- Single-tick / double-tick delivery and read indicators
- Voice and video calling with WebRTC signaling
- Optional STUN/TURN configuration for difficult networks
- Web/PWA install support
- Capacitor Android build in CI
- Lightweight Fastify + Socket.IO server
- Persistent self-hosted JSON data volume for the current foundation
- Docker deployment option
- No dependency on Render for the application architecture

## Important architecture note

The client can work offline without a server, but internet messaging between different devices still requires a reachable realtime service. Voice/video calls use WebRTC and require browser permission plus a secure context such as HTTPS; a TURN relay may be needed when direct peer connectivity is unavailable.

The current server provides signed, expiring bearer sessions and authenticated Socket.IO connections. For production, set a stable `SESSION_SECRET` so sessions survive server restarts.

## Local development

```bash
npm install
npm run dev
```

Web: `http://localhost:5173`
API: `http://localhost:3000`

For a separate API, build the web app with `VITE_API_URL=https://your-api.example.com`.

For WebRTC TURN support, provide these web build variables when needed:

```text
VITE_TURN_URL=turn:your-turn-server:3478
VITE_TURN_USERNAME=your-username
VITE_TURN_CREDENTIAL=your-credential
```

## Docker

Build the web app first, then:

```bash
npm install
npm run build -w apps/web
docker compose -f deploy/docker-compose.yml up -d --build
```

Set `WEB_ORIGIN` and `SESSION_SECRET` in the deployment environment rather than relying on development defaults.

## Android

The GitHub Actions workflow builds a debug APK automatically. The Android job first generates/synchronizes the Capacitor Android project and only then enables Gradle dependency caching. This avoids cache initialization failures before the generated Gradle files exist.

Download the `pro-chat-android-debug` artifact from a successful workflow run and install it on Android.

## Roadmap

Next production layers:

1. Full account/recovery authentication and device/session management
2. PostgreSQL or another transactional database for multi-instance deployments
3. True end-to-end encryption using a vetted protocol/library
4. Push notification delivery through FCM/APNs
5. Media/file uploads with access controls
6. Group chats and stronger message synchronization
7. Production HTTPS and a self-hosted TURN service
8. Rate limiting, abuse protection, observability, backups, and migrations
