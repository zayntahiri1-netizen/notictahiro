# Store Compliance Audit - Notic Tahiro

Last updated: 2026-05-21

This audit is for Google Play and Apple App Store readiness. It is not legal advice and does not guarantee approval.

## 1. Required public pages

Status: implemented in-app and Firebase-ready.

- `/privacy` - Privacy Policy
- `/delete-data` - Delete Data
- `/about` - About
- `/contact` - Contact

Firebase Hosting is configured with SPA rewrites in `firebase.json` so direct routes work after deployment.

## 2. Contact information

Status: implemented.

- Contact email: `zayntahiri1@gmail.com`
- Email appears in legal/static pages.

## 3. Data handling

Current app behavior:

- Local-first storage through browser/app storage.
- Notes, tasks, finance entries, debt records, language, and UI settings are stored locally.
- No production backend collection is currently implemented in this codebase.

If Firebase Auth/Firestore is enabled later, both Privacy Policy and store declarations must be updated.

## 4. AI safety

Status: improved.

- AI features are productivity assistance.
- No frontend Gemini key should be added.
- Backend proxy / Cloud Functions required for production AI.
- Financial and crypto analysis is presented as educational/personal organization, not investment advice.

## 5. Financial policy

Status: improved.

- Debt/credit tools are personal organization features.
- Decision Matrix crypto comparison no longer gives a direct recommendation.
- Store listing drafts include finance disclaimer.

## 6. Ads policy readiness

Status: no ads integrated in current code.

If AdMob or AdSense is added later:

- Add consent flow where required.
- Add `app-ads.txt` for AdMob.
- Add `ads.txt` for AdSense.
- Do not place ads near navigation, delete buttons, or controls.
- Do not incentivize clicks.
- Update Google Play Data Safety and App Store privacy answers.

## 7. Permissions readiness

Status: controlled by future native implementation.

Recommended:

- Request notification permission only after user creates a reminder.
- Request clipboard access only on user action.
- Avoid location, contacts, SMS, call log, and broad storage permissions.
- If microphone recording is added, provide clear disclosure and no background recording.

## 8. Children policy

Status: not child-directed.

- App should be listed for general productivity audience, not designed for children under 13.
- If targeting children later, remove personalized ads and review Families Policy.

## 9. Build readiness

Status: prepared.

- Capacitor config exists.
- Android GitHub Actions workflow exists.
- iOS GitHub Actions workflow exists.
- Firebase Hosting config exists.

## 10. Known items to complete outside code

- Deploy Firebase Hosting before store review.
- Add screenshots in Play Console / App Store Connect.
- Add feature graphic and app icon assets in store portals.
- Fill Google Play Data Safety truthfully.
- Fill App Store App Privacy truthfully.
- Configure signing secrets for automated signed builds.
- Test on physical Android and iOS devices.