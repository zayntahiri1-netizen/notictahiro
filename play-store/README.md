# Notic Tahiro - Google Play Store Readiness Pack

This folder contains operational documents to prepare Notic Tahiro for Google Play review.

Important: these files help you prepare, but Google Play approval depends on the real app behavior, Play Console declarations, permissions, store listing, and published privacy/delete-data URLs.

## Files

- `release-checklist.md` - final checklist before submission.
- `data-safety.md` - suggested Google Play Data Safety answers.
- `permissions-declaration.md` - permissions and why they are needed.
- `store-listing-ar.md` - Arabic store listing draft.
- `store-listing-en.md` - English store listing draft.
- `content-rating.md` - content rating guidance.
- `privacy-policy-url.md` - required public URLs.

## Current app status

- App name: Notic Tahiro
- Package name: com.notictahiro.app
- Firebase project: notictahiro
- Main contact email: zayntahiri1@gmail.com
- Web hosting ready through Firebase Hosting.
- Android AAB build workflow exists in `.github/workflows/google-play-android.yml`.

## Must be public before production review

Google Play requires a public privacy policy URL. The in-app pages are not enough unless they are also accessible through Firebase Hosting on HTTPS.

Recommended URLs after Firebase deploy:

- https://notictahiro.web.app/privacy
- https://notictahiro.web.app/delete-data
- https://notictahiro.web.app/about
- https://notictahiro.web.app/contact

If your Firebase Hosting domain is different, use your actual domain.