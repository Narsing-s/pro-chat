# Pro Chat — remote production deployment

The production stack is designed to run the web client and Fastify API on one public HTTPS origin. This removes the localhost dependency from the installed app and keeps REST and Socket.IO on the same origin.

## Server requirements

- Public Linux VPS/server
- DNS `A`/`AAAA` record pointing the chosen domain to the server
- TCP ports 80 and 443 open
- Docker Engine with Docker Compose v2
- SSH access for the GitHub Actions deploy key
- PostgreSQL/Neon connection string

The repository does not include a production database password or session secret.

## GitHub production environment

Create a GitHub Actions environment named `production` and add these secrets:

- `PRO_CHAT_REMOTE_HOST` — server hostname/IP
- `PRO_CHAT_REMOTE_USER` — SSH user
- `PRO_CHAT_REMOTE_PATH` — deployment directory, for example `/opt/pro-chat`
- `PRO_CHAT_SSH_KEY` — private SSH key matching an authorized key on the server
- `PRO_CHAT_DOMAIN` — public domain, for example `chat.example.com`
- `PRO_CHAT_DATABASE_URL` — PostgreSQL/Neon connection string
- `PRO_CHAT_SESSION_SECRET` — random secret of at least 32 characters

Optional environment variables:

- `PRO_CHAT_REMOTE_DEPLOY=true` — enables automatic deployment on pushes to `main`
- `PRO_CHAT_REQUIRE_EMAIL_VERIFICATION=true|false`
- `PRO_CHAT_REQUIRE_PHONE_VERIFICATION=true|false`
- `PRO_CHAT_DEVICE_APPROVAL=true|false`

## First server setup

Install Docker and Docker Compose v2 on the VPS and add the deployment public key to the SSH user's `authorized_keys`.

The GitHub workflow then:

1. Connects to the VPS over SSH.
2. Clones or updates the public Pro Chat repository.
3. Installs the production `.env` from GitHub Actions secrets.
4. Builds the API and web containers.
5. Starts the API, web gateway, and Caddy HTTPS proxy.
6. Checks `https://DOMAIN/health` before reporting success.

Caddy obtains and renews the HTTPS certificate automatically after DNS points at the server and ports 80/443 are reachable.

## Manual deployment

Run the **Pro Chat Remote Deploy** workflow from GitHub Actions after configuring the production environment.

For automatic deployments, set `PRO_CHAT_REMOTE_DEPLOY=true` in the repository/environment variables.

## Important

Do not put `DATABASE_URL`, `SESSION_SECRET`, SMTP credentials, SMS credentials, or private SSH keys in the repository. Keep them in GitHub Actions secrets or the server's protected environment file.
