# Notic Tahiro - Google Play / AdMob / AdSense Readiness Checklist

This document is a developer checklist. It does not replace legal review or Google approval.

## Privacy and Data Safety

- Privacy Policy page exists at `#/privacy`.
- Delete Data page exists at `#/delete-data`.
- Contact page exists at `#/contact` with email: `zayntahiri1@gmail.com`.
- The app explains data categories: notes, projects, tasks, reminders, finance entries, debt records, language and interface preferences.
- The app states that data is not sold.
- The app states that AI keys should be protected server-side and not exposed in frontend code.
- If cloud sync is added, update the Data Safety form in Google Play Console to match the real collection/sharing practices.

## Consent and Ads

- A consent banner is implemented in `src/components/ConsentBanner.tsx`.
- Consent choices are stored in `localStorage` under `notic-consent-v1`.
- Before enabling AdMob or AdSense, integrate Google UMP SDK / Consent Mode according to the target platform.
- Do not show personalized ads without the required consent in EEA/UK and other regulated regions.
- Do not place ads near destructive buttons, navigation controls, or accidental tap areas.
- Do not incentivize ad clicks.
- Ads must be visually distinguishable from app content.

## Content and Financial Features

- Financial features must be positioned as personal organization tools, not financial advice.
- Avoid guaranteed returns, investment promises, or direct investment recommendations.
- Decision Matrix includes a neutral educational disclaimer for crypto comparisons.

## Children and Families

- The app is not directed to children under 13.
- If the app is later submitted under the Families policy, remove personalized ads and review every data collection path.

## Account and Data Deletion

- If user accounts are added, provide in-app and web data deletion request paths.
- Backend deletion should remove Firestore, Storage, authentication-linked records, and AI-processing logs if any.

## Required Before Production Ads

- Add the real Google publisher ID to `ads.txt` / `app-ads.txt` on the verified developer website.
- Add app-ads.txt URL in Google Play Console if using AdMob.
- Add AdSense site verification and policy-compliant ad placements if using AdSense on web.
- Complete Play Console Data Safety, Ads declaration, and Content Rating truthfully.