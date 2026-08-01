# Notic Tahiro - App Store Release Guide

This guide prepares Notic Tahiro for Apple App Store submission through Capacitor iOS.

Important: this guide helps with readiness, but Apple approval depends on the real binary, App Store Connect declarations, permissions, screenshots, review notes, and privacy details.

## App identity

- App name: Notic Tahiro
- Bundle ID: `com.notictahiro.app`
- Category: Productivity
- Support email: `zayntahiri1@gmail.com`

## Required public pages

These pages must be publicly accessible through HTTPS before review:

- Privacy Policy: `https://notictahiro.web.app/privacy`
- Delete Data: `https://notictahiro.web.app/delete-data`
- About: `https://notictahiro.web.app/about`
- Contact: `https://notictahiro.web.app/contact`

If your Firebase Hosting URL is different, use the real deployed domain.

## App Privacy in App Store Connect

For the current local-first version, declare only what the released app actually collects.

If the app does not transmit notes, finance records, debt records, or identifiers to a server, do not mark those as collected by the developer. If you later add Firebase, analytics, AI cloud processing, ads, or accounts, update the privacy answers.

Suggested current local-first privacy posture:

- Data Used to Track You: No
- Data Linked to You: No, unless account login is enabled
- Data Not Linked to You: No, unless analytics or crash reporting is enabled
- User Content: stored locally on device unless sync is added
- Financial Info: stored locally for user organization unless sync is added

## Permissions

Only request permissions when the user starts a feature that needs them.

- Notifications: ask only when the user creates reminders.
- Clipboard: access only on user action for Smart Clipboard.
- Files: request only for export/import or attachment features.
- Microphone: do not request unless real voice recording is shipped.
- Location: do not request unless geofenced reminders are fully implemented and clearly explained.

## AI and finance disclaimers

- AI suggestions are assistance only and may be inaccurate.
- Finance, debt, and crypto comparison tools are personal organization features, not financial, legal, tax, or investment advice.
- Avoid investment recommendations or guaranteed outcomes in screenshots, metadata, and in-app copy.

## iOS build from GitHub Actions

Workflow file:

- `.github/workflows/app-store-ios.yml`

The workflow can build an unsigned iOS project artifact by default. For App Store upload, configure Apple signing secrets and update the workflow to archive/export a signed IPA.

## App Store review notes template

Use this in App Review notes:

```text
Notic Tahiro is a productivity app for private notes, ideas, reminders, personal finance organization, and debt/credit tracking.

The app currently stores data locally on the user's device unless cloud sync is explicitly enabled in a future version.

AI-related features are productivity assistance and simulated/local in this build unless a backend AI service is enabled. The app does not provide financial, investment, tax, or legal advice.

Contact: zayntahiri1@gmail.com
Privacy Policy: https://notictahiro.web.app/privacy
Delete Data: https://notictahiro.web.app/delete-data
```

## Final App Store checklist

- [ ] Public privacy URL is live and not behind login.
- [ ] Delete-data URL is live and not behind login.
- [ ] App Privacy answers match real app behavior.
- [ ] No hidden API keys in frontend.
- [ ] No placeholder content in screenshots.
- [ ] No direct investment advice in metadata.
- [ ] All permissions have clear user value.
- [ ] App works offline for local notes.
- [ ] Test on iPhone small screen, iPhone large screen, and iPad if supported.
- [ ] Support email works.