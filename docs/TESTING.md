# Pro Chat Testing Guide

Testing should prove the complete user journey, not only that individual API endpoints return a response.

## 1. Local prerequisites

- Node.js 22+
- npm
- PostgreSQL/Neon database for backend tests
- Java 21 and Android tooling for Android builds

Install dependencies:

```bash
npm install
```

Build both applications:

```bash
npm run build --workspace apps/server
npm run build --workspace apps/web
```

## 2. Backend health

Start the backend and verify:

```text
GET /health
```

A healthy response should report that the service is running and that the configured database is reachable.

A successful `/health` check does not prove authentication, authorization or messaging works.

## 3. Authentication smoke test

Run this sequence against a clean test account:

1. Create an account with email, phone, username, password and confirmation.
2. Confirm duplicate username/email/phone handling.
3. Log in using username.
4. Log out.
5. Log in using email.
6. Log out.
7. Log in using phone.
8. Request password reset.
9. Complete reset with a valid single-use token.
10. Confirm an expired/used token is rejected.
11. Change password while authenticated.
12. Confirm old credentials no longer work.
13. Verify session/logout behavior across devices.

Never weaken verification or reset checks to make a smoke test pass.

## 4. Messaging smoke test

Use two independent test accounts:

1. Account A logs in.
2. Account B logs in from another browser/device.
3. A searches for B.
4. A opens or creates a 1:1 chat.
5. A sends a text message.
6. B receives the message through realtime transport.
7. B replies.
8. A receives the reply without a manual refresh.
9. Verify message history after reconnecting.
10. Verify edit/delete authorization with the correct user.

## 5. Realtime tests

Check all of the following:

- Socket connection requires authentication.
- Invalid/expired credentials are rejected.
- Reconnect restores the authenticated session.
- Duplicate connections do not create duplicate message delivery.
- A message is not delivered to an unauthorized chat participant.
- Disconnect/reconnect does not silently lose persisted messages.

## 6. Web UI tests

Verify on desktop and mobile viewport sizes:

- Login and registration forms remain usable.
- Loading/error states are visible.
- Chat list is usable when many chats exist.
- Composer remains at the bottom of the active conversation.
- Keyboard input and Enter/Shift+Enter behavior are correct.
- Attachments and emoji controls do not break the composer.
- Navigation does not reload the application unexpectedly.
- Browser refresh preserves only the intended authenticated state.

## 7. Passkey tests

Passkeys must be tested only on supported secure origins.

Test:

1. Register a passkey for an authenticated test account.
2. Confirm the credential is stored server-side for the correct user.
3. Log out.
4. Start passkey login.
5. Complete the browser WebAuthn ceremony.
6. Confirm the server verifies the challenge, origin, RP ID and credential.
7. Confirm an invalid/replayed challenge fails.
8. Confirm a credential belonging to another user cannot authenticate the account.

## 8. Android tests

For debug builds:

```bash
npm run build --workspace apps/web
npx cap sync android
cd apps/mobile
./gradlew assembleDebug
```

Verify installation, authentication, chat navigation, realtime reconnect and back-button behavior on a physical Android device.

## 9. Production smoke test

Before a release:

- HTTPS frontend loads.
- Backend `/health` is 200.
- Database connectivity is healthy.
- Frontend API points to the public backend, not localhost or the GitHub Pages origin.
- `WEB_ORIGIN` exactly matches the frontend HTTPS origin.
- Login works.
- Two-user messaging works.
- WebSocket/Socket.IO connection works over WSS.
- Password recovery is configured.
- Passkeys work on the production secure origin.
- Browser console has no authentication/network errors.
- No secret appears in frontend source or network payloads.

## 10. Release gate

Do not call a release production-ready if the core path fails:

`Create Account → Login → Home → New Chat → Send Message → Receive Message`

Automated tests are necessary, but the final release gate must also include a real end-to-end smoke test using two separate test accounts.