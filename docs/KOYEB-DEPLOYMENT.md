# Pro Chat — Koyeb deployment

Koyeb can deploy the Pro Chat Fastify API directly from this GitHub repository. Koyeb Web Services support HTTP and WebSocket applications, so the API and Socket.IO realtime layer can run together. The repository includes `apps/server/Dockerfile.koyeb` for this deployment.

## Koyeb setup

1. Open the Koyeb control panel.
2. Create a **Web Service** and choose **GitHub**.
3. Connect GitHub and select `Narsing-s/pro-chat`, branch `main`.
4. Select **Dockerfile** as the builder.
5. Set Dockerfile location to `apps/server/Dockerfile.koyeb`.
6. Expose HTTP port `3000` and route `/` to port `3000`.
7. Set the service environment variables below.
8. Deploy and wait for the service to become healthy.

Koyeb will provide a public `*.koyeb.app` address. Use that address as the API origin while the frontend is hosted separately, or deploy the frontend with the same service in a later step.

## Required environment variables

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
DATABASE_URL=<your Neon PostgreSQL connection string>
SESSION_SECRET=<random secret of at least 32 characters>
WEB_ORIGIN=<public frontend origin>
WEBAUTHN_RP_ID=<frontend hostname>
WEBAUTHN_RP_NAME=Pro Chat
WEBAUTHN_ORIGIN=<public frontend origin>
REQUIRE_EMAIL_VERIFICATION=false
REQUIRE_PHONE_VERIFICATION=false
REQUIRE_DEVICE_APPROVAL=false
```

For an initial deployment where the frontend and API are on different origins, set `WEB_ORIGIN` to the exact frontend origin. If the frontend is on GitHub Pages, this will be its HTTPS Pages origin.

## Frontend

Set the GitHub Pages repository variable `PRO_CHAT_API_URL` to the Koyeb HTTPS API URL, for example:

```text
https://your-service-your-org.koyeb.app
```

Then rerun the Pages workflow. The frontend will call `/api/...` on that configured API origin and Socket.IO will connect to the same origin.

## Important

Do not commit `DATABASE_URL`, `SESSION_SECRET`, SMTP credentials, SMS credentials, or any private key. Put them only into Koyeb environment variables/secrets or GitHub repository/environment secrets.

Koyeb deployments from GitHub can automatically redeploy when the tracked branch changes. This means future pushes to `main` can update the remote API without SSH or a VPS.
