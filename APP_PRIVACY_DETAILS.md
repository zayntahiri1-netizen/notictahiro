# App Privacy Details - Notic Tahiro

Use this document when filling Apple App Store Connect privacy questions.

## Current local-first version

If released without backend sync, analytics, ads, or account login:

### Data collected by developer

None, if user content remains only on device and is not transmitted to a server controlled by the developer.

### Data stored on device

The app may store locally:

- Notes and ideas
- Tasks and reminders
- Finance entries
- Debt and credit records
- Language setting
- Theme preference
- Local productivity settings

This local storage is controlled by the user and can be deleted through the Delete Data page.

### Tracking

No tracking in the current local-first codebase.

### Third-party data sharing

No third-party sharing in the current local-first codebase.

## If future features are enabled

Update App Privacy if you add any of the following:

- Firebase Auth
- Firestore sync
- Cloud Storage attachments
- Gemini API backend processing
- Analytics
- Crash reporting
- AdMob
- In-app purchases

## Recommended App Store privacy notes

```text
Notic Tahiro stores user-created productivity content locally on device in the current version. If cloud sync or AI backend processing is enabled in a future version, the privacy policy and App Privacy details will be updated before release.
```