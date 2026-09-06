# Pro Chat Releases

## Where releases should live

### Recommended: Google Play

Use Google Play production releases for normal global users. Google Play distributes the correct APK configuration from the signed App Bundle for each supported device.

### GitHub Releases

Use GitHub Releases as the official developer-facing release archive and direct-download fallback. Each release should contain release notes and signed release artifacts where appropriate.

### CI artifacts

GitHub Actions artifacts are temporary build outputs for CI/testing and should not be treated as the permanent public download location.

## Release checklist

- [ ] Version name updated
- [ ] Version code increased
- [ ] Production API URL configured
- [ ] HTTPS/WSS verified
- [ ] Production session secret configured
- [ ] Email/reset provider configured
- [ ] Android release signing configured
- [ ] Release AAB built
- [ ] Release APK generated for direct testing/distribution if needed
- [ ] Web build verified
- [ ] Server build verified
- [ ] Authentication tested
- [ ] Messaging tested
- [ ] Calls tested
- [ ] Notifications tested
- [ ] Privacy/security checks completed
- [ ] Release notes published
- [ ] SHA-256 checksums published for direct-download files

## Latest-release rule

Never tell users to download a debug APK as the permanent public release. Debug artifacts are useful for testing. The production path should be a signed release build distributed through Google Play or the project's official release page.
