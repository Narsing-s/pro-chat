# Northflank deployment

Pro Chat can be deployed on Northflank as a combined service from the GitHub repository. Northflank supports GitHub repositories, custom Dockerfiles, public HTTP/S ports, health checks, and secret/environment-variable management.

## 1. Create the project

Open Northflank and create a project. For testing, the Developer Sandbox currently includes up to 2 services and 1 database/addon within its free limits.

## 2. Connect GitHub

Link the GitHub account that owns `Narsing-s/pro-chat`.

## 3. Create the backend service

Create a **Combined service** and configure:

- Repository: `Narsing-s/pro-chat`
- Branch: `main`
- Build type: Dockerfile
- Dockerfile path: `apps/server/Dockerfile.northflank`
- Docker work directory/build context: repository root
- Public port: `3000`, protocol `HTTP`
- Health check: `GET /health` on port `3000`

Northflank will provide a public HTTPS service URL.

## 4. Runtime environment variables

Set these as Northflank secrets/environment variables. Never commit their values to Git.

Required:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=3000`
- `DATABASE_URL=<your Neon PostgreSQL connection string>`
- `SESSION_SECRET=<random secret of at least 32 characters>`
- `WEB_ORIGIN=<your deployed web application's HTTPS origin>`

Authentication integrations, if enabled later, can add their provider-specific variables through Northflank secrets.

## 5. Deploy

Save the service configuration and deploy the `main` branch. After the first successful build/deployment, open the generated HTTPS URL and verify:

`GET /health`

The response should report the Pro Chat service as healthy.

## 6. Frontend

Set the GitHub Pages repository variable `PRO_CHAT_API_URL` to the Northflank HTTPS API origin, then run the Pages workflow. The web application should use that origin for API and realtime connections.

## Security

Do not put `DATABASE_URL`, `SESSION_SECRET`, provider API keys, SMTP credentials, or other secrets into source files, Dockerfiles, GitHub commits, or chat messages. Use Northflank's secret/environment-variable management.
