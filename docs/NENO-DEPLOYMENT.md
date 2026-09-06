# Pro Chat — Neno deployment

## Important

The Pro Chat API uses Fastify 5. Fastify 5 requires Node.js 20 or newer. Do **not** deploy the API to a Neno plan that only exposes Node.js 6–14.

Use a Neno VPS (or another server) with Node.js 20+ and SSH access.

## Existing Neon database

No new Neon database is required. Keep the existing Neon project/database.

Set these environment variables on the server only:

```env
DATABASE_URL=<rotated Neon pooled connection string>
SESSION_SECRET=<long random secret>
WEB_ORIGIN=https://<your-github-pages-domain>
PORT=3000
```

Never put `DATABASE_URL` or `SESSION_SECRET` in frontend code or `VITE_*` variables.

## VPS setup

```bash
sudo apt update
sudo apt install -y git curl nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

Clone and build:

```bash
git clone https://github.com/Narsing-s/pro-chat.git
cd pro-chat
npm install
npm run build -w apps/server
```

Create the production environment file outside the repository:

```bash
sudo mkdir -p /etc/pro-chat
sudo nano /etc/pro-chat/server.env
```

Put the four variables shown above in that file.

Start the API with systemd:

```bash
sudo tee /etc/systemd/system/pro-chat-api.service >/dev/null <<'EOF'
[Unit]
Description=Pro Chat API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pro-chat
EnvironmentFile=/etc/pro-chat/server.env
ExecStart=/usr/bin/node /opt/pro-chat/apps/server/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo chown -R www-data:www-data /opt/pro-chat
sudo systemctl daemon-reload
sudo systemctl enable --now pro-chat-api
sudo systemctl status pro-chat-api --no-pager
```

Test locally on the VPS:

```bash
curl http://127.0.0.1:3000/health
```

The API must return a healthy response before configuring the frontend.

## Nginx

Proxy both API requests and Socket.IO to port 3000. WebSocket upgrade is required for realtime messaging.

Example:

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable HTTPS with your normal Neno/Let's Encrypt setup, then set `WEB_ORIGIN` to the exact HTTPS frontend origin.

## GitHub Pages frontend

Create the GitHub Actions repository variable:

```text
PRO_CHAT_API_URL=https://api.example.com
```

The Pages workflow already reads `VITE_API_URL` from this repository variable.

After updating the variable, rerun the Pages workflow and install the newly built APK/web app.

## Verification

Test in this order:

1. `GET /health`
2. Create account
3. Confirm account persists in Neon
4. Logout
5. Login using email/phone/username
6. Search another user
7. Open chat
8. Send a message
9. Confirm realtime delivery through Socket.IO
10. Restart API and confirm sessions/messages still persist

## Security

If a Neon connection string was ever exposed publicly, rotate the Neon database password before production deployment. Do not commit the replacement credential to GitHub.
