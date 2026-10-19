# Notic Tahiro - Google Play Release Guide

This project is prepared to build an Android App Bundle (AAB) through GitHub Actions using Capacitor.

## Android package

- Package name: `com.notictahiro.app`
- App name: `Notic Tahiro`
- Web output: `dist`
- Capacitor config: `capacitor.config.ts`

## GitHub Actions workflow

Workflow file:

- `.github/workflows/google-play-android.yml`

The workflow:

1. Installs dependencies.
2. Builds the Vite web app.
3. Adds Android platform if missing.
4. Syncs Capacitor.
5. Builds release AAB.
6. Uploads the AAB as a GitHub artifact.
7. Optionally uploads to Google Play Internal Testing if secrets are configured.

## Required GitHub Secrets for signed builds

Add these in GitHub repository settings:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Generate a keystore locally:

```bash
keytool -genkeypair -v -keystore release.keystore -alias notic-tahiro -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 release.keystore
```

Use the base64 result for `ANDROID_KEYSTORE_BASE64`.

## Optional Google Play upload secret

To upload automatically to Google Play Internal Testing, add:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

This must be the JSON content of a Play Console service account with permissions to upload releases.

## Google Play policy checklist

Before production release, verify:

- Privacy Policy is published at a public HTTPS URL.
- Delete Data page is published at a public HTTPS URL.
- Data Safety form matches the actual app behavior.
- If ads are enabled, complete the Ads declaration.
- If AdMob is used, configure app-ads.txt on a verified website.
- If AI cloud processing is enabled, do not expose API keys in frontend code.
- If accounts are added, provide account deletion in-app and on web.
- If notifications are added, request permission clearly and only when needed.

## Current policy posture

The current codebase is local-first and does not integrate ads, analytics, account login, or backend data collection by default. If any of these are added later, the Play Console Data Safety form and Privacy Policy must be updated before release.

Review these files before submitting:

- `STORE_COMPLIANCE_AUDIT.md`
- `play-store/release-checklist.md`
- `play-store/data-safety.md`
- `play-store/permissions-declaration.md`

## Important note about direct routes

The app supports these routes:

- `/privacy`
- `/delete-data`
- `/about`
- `/contact`

When hosting the web version, configure SPA fallback to `index.html` so direct links work.

For Firebase Hosting, add a rewrite:

```json
{
  "rewrites": [
    { "source": "**", "destination": "/index.html" }
  ]
}
```