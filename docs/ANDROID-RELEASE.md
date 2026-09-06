# Android release and distribution

Pro Chat is built so normal users do **not** need ADB, Java, Android Studio, or developer tools to install the app.

## Current CI artifacts

Every successful `main` build produces:

- `pro-chat-web` — web build
- `pro-chat-android-debug` — Android debug APK for testing

These are CI artifacts, not permanent production releases.

## Production release

The production release pipeline builds:

- Android App Bundle (`.aab`) for Google Play
- Signed release APK (`.apk`) for direct distribution / GitHub Releases

Before publishing a production tag, configure these GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Never commit a keystore or passwords to the repository.

## Google Play readiness

As of August 31, 2026, new Google Play apps and app updates must target Android 16 / API 36 or higher. The CI therefore sets Android compile/target SDK to 36.

The Play Console also has Android developer verification and package-name registration requirements. Complete those in the Play Console before public launch.

## Release flow

1. Configure production API (`VITE_API_URL`) and HTTPS/WSS.
2. Configure server secrets such as `SESSION_SECRET` and the email provider for password recovery.
3. Configure the Android signing secrets above.
4. Push a version tag such as `v1.0.0`.
5. GitHub Actions builds and verifies the Android bundle/APK.
6. The release workflow publishes the signed artifacts to GitHub Releases.
7. Upload the `.aab` to Google Play Console for the global production rollout.

Google Play is the preferred installation path for normal Android users. GitHub Releases is the official direct-download fallback and developer archive.
