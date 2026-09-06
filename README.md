# Pro Chat

A clean, offline-first messaging foundation for web and Android.

## What is included

- Responsive messenger UI
- Local-first message storage using browser storage
- Automatic realtime reconnect with Socket.IO
- Single-tick / double-tick delivery indicator foundation
- Web/PWA install support
- Capacitor Android project generation in CI
- Lightweight Fastify + Socket.IO server
- Docker deployment option
- No dependency on Render for the application architecture

## Important architecture note

The client can work offline without a server, but internet messaging between two different devices still requires a reachable signaling/realtime service. This repository keeps that service intentionally small so it can be self-hosted on a VM, home server, or any compatible host.

## Local development

```bash
npm install
npm run dev
```

Web: `http://localhost:5173`
API: `http://localhost:3000`

For a separate API, build the web app with `VITE_API_URL=https://your-api.example.com`.

## Docker

Build the web app first, then:

```bash
npm install
npm run build -w apps/web
docker compose -f deploy/docker-compose.yml up -d --build
```

## Android

The GitHub Actions workflow builds a debug APK automatically. Download the `pro-chat-android-debug` artifact from the workflow run and install it on Android.

## Roadmap

The foundation is intentionally small. The next production layer should add real authentication, persistent PostgreSQL storage, encrypted message payloads, push notifications, reliable delivery/read receipts, media uploads, WebRTC call signaling, group chats, and device/session management.