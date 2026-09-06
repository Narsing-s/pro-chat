# Passkeys and WebAuthn

Pro Chat supports passkey foundations using the WebAuthn standard. Passkeys are a phishing-resistant authentication mechanism, but they must be implemented with strict server-side verification.

## Flow

```text
Browser
  │
  ├── request registration/login options
  ▼
Pro Chat API
  │
  ├── creates a short-lived challenge
  └── stores challenge server-side
  ▼
Browser WebAuthn API
  │
  └── navigator.credentials.create/get
  ▼
Pro Chat API
  │
  ├── verifies challenge
  ├── verifies origin
  ├── verifies RP ID
  ├── verifies credential/user binding
  └── creates authenticated session
```

## Browser requirements

WebAuthn is a secure-context browser API. Production passkeys should therefore run on the HTTPS application origin. Do not depend on dynamically importing an authentication package from a `/node_modules` URL on a static host unless that dependency is actually present in the deployed static artifact.

The current client uses the browser's native credential APIs so the static web deployment does not depend on an unbundled package path.

## Server requirements

The server is responsible for:

- Generating unpredictable, short-lived challenges.
- Binding registration/authentication challenges to the intended operation and user where applicable.
- Verifying the expected origin.
- Verifying the expected RP ID.
- Verifying the credential's public key and user binding.
- Tracking credential IDs and counters as required by the WebAuthn implementation.
- Rejecting expired, missing, reused or mismatched challenges.
- Creating the normal authenticated application session only after successful verification.

## Security rules

Never implement a passkey fallback that simply trusts a client-provided success flag, credential ID, username or assertion fields.

Never accept a challenge supplied by the browser as authoritative. The server must create and validate its own challenge.

Never log private credential material, session secrets or authentication assertions unnecessarily.

Passkeys do not replace authorization. Every protected API and realtime action must still verify the authenticated user's authorization for the requested resource.

## Testing

See [TESTING.md](TESTING.md) for registration, login, replay and cross-user credential tests.

See [SECURITY.md](SECURITY.md) for the broader authentication and session security requirements.