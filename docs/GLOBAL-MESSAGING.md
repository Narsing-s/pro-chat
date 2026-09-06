# Pro Chat — global messaging architecture

Pro Chat is designed as an offline-first client, but real cross-device messaging requires a reachable communication endpoint. GitHub Pages can serve the web client, but it cannot route Socket.IO messages between unrelated phones.

## What is already in the repository

- Account registration with email, phone number, username and password.
- Login with username, email or phone number.
- Passwords are hashed; plaintext passwords are not stored by the server.
- Socket.IO real-time messaging and presence.
- Message persistence and delivery/read state.
- Offline outbox and reconnect handling in the web client.
- A self-hostable Node/Fastify server and Dockerfile.

## Global deployment model

1. Build the web/PWA or Android APK.
2. Run `apps/server` on infrastructure you control that has a public HTTPS/WSS endpoint.
3. Set `SESSION_SECRET` to a long random secret.
4. Set `WEB_ORIGIN` to the exact public web origin.
5. Set the web build variable `VITE_API_URL` to the public API origin.
6. Keep the server data directory on persistent storage so users/messages survive restarts.
7. Put the API behind TLS. Socket.IO must be reachable through HTTPS/WSS from mobile networks.

Example environment:

```text
NODE_ENV=production
PORT=3000
SESSION_SECRET=<long-random-secret>
WEB_ORIGIN=https://chat.example.com
DATA_FILE=/app/data/pro-chat.json
```

Example Docker build from the repository root:

```bash
docker build -f apps/server/Dockerfile -t pro-chat-server .
docker run -d --name pro-chat-server \
  -p 3000:3000 \
  -v pro-chat-data:/app/data \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e SESSION_SECRET='<long-random-secret>' \
  -e WEB_ORIGIN='https://chat.example.com' \
  pro-chat-server
```

## Important

There is deliberately no Render, Firebase, AWS, Azure or other third-party hosting dependency in the application. The repository is deployment-independent. However, no software-only change can make two unrelated phones exchange messages globally when there is no reachable Internet/rendezvous infrastructure. Once the server is made publicly reachable, users in different countries can connect to the same Pro Chat service.
