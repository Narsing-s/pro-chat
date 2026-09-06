# Pro Chat — Koyeb Free Deployment

This repository includes a GitHub Actions workflow at `.github/workflows/koyeb-deploy.yml` that deploys the Pro Chat API to Koyeb without a VPS or SSH key.

## Koyeb account

Koyeb currently provides one Free Web Service per organization. The free instance is 512 MB RAM, 0.1 vCPU and 2 GB SSD, and it scales to zero after one hour without traffic. It is intended for testing and hobby projects, not production. Do not select a paid instance. 

## 1. Create a Koyeb API token

In Koyeb, open your account settings and create a Personal Access Token. Store it safely; Koyeb does not show the token again after creation.

## 2. Add GitHub repository secrets

In GitHub: Repository → Settings → Secrets and variables → Actions → New repository secret.

Create these four secrets:

- `KOYEB_API_TOKEN` — Koyeb Personal Access Token.
- `PRO_CHAT_DATABASE_URL` — your Neon PostgreSQL connection string.
- `PRO_CHAT_SESSION_SECRET` — a random secret of at least 32 characters.
- `PRO_CHAT_WEB_ORIGIN` — the public HTTPS origin of the web app, for example your GitHub Pages URL.

Never commit these values to the repository.

## 3. Run the deployment

Open GitHub → Actions → `Deploy Pro Chat API to Koyeb` → `Run workflow` → branch `main` → `Run workflow`.

The workflow creates the Koyeb service using the repository Dockerfile:

`apps/server/Dockerfile.koyeb`

It exposes port `3000` and checks `/health`.

## 4. Get the API URL

After deployment, Koyeb gives the service a public `*.koyeb.app` URL. Test:

`https://YOUR-KOYEB-DOMAIN/health`

The response should contain `ok: true`.

## 5. Connect the frontend

In GitHub repository Settings → Secrets and variables → Actions → Variables, create:

`PRO_CHAT_API_URL=https://YOUR-KOYEB-DOMAIN`

The existing GitHub Pages workflow uses this variable as `VITE_API_URL`.

## Important

Do not use the Koyeb free instance for production-scale messaging. It is a free testing/hobby runtime and sleeps after inactivity. For a real public launch, move the API to a paid or dedicated runtime later while keeping the same container architecture.
