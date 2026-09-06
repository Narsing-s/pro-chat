# Contributing to Pro Chat

Thanks for helping improve Pro Chat.

## Before you start

Read:

- [Development Guide](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security Guide](docs/SECURITY.md)

## Pull requests

1. Keep changes focused.
2. Explain the user-visible or technical reason for the change.
3. Include tests or a clear manual verification procedure.
4. Do not include secrets or personal data.
5. Do not weaken authentication, authorization, rate limits or WebAuthn verification to make tests pass.
6. Update documentation when behavior or deployment requirements change.

## Validation

At minimum, run:

```bash
npm run build -w apps/server
npm run build -w apps/web
```

For authentication changes, manually verify registration, login, logout and recovery. For messaging changes, verify send, receive, reconnect and chat composer behavior.

## Commit messages

Prefer short imperative messages such as:

```text
fix: keep chat composer at bottom
feat: add passkey login
security: tighten reset-token validation
docs: update deployment guide
```
