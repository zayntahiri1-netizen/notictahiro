# Google Play Data Safety — Answers Matching the SHIPPED App

⚠️ These answers describe the app **as actually shipped**: AdMob ads are
enabled (banner, interstitial, app open) and AI features send note content
to a secure backend (Supabase Edge Function → Google Gemini).
Declaring less than this is a direct rejection/suspension reason.

## Data collected

- **Device or other IDs: YES** — the AdMob SDK collects the Advertising ID
  to serve and measure ads. (Required answer because ads are shipped.)
- **App interactions / Diagnostics:** YES if Firebase/Google Analytics is
  enabled; otherwise only what the AdMob SDK collects for ad measurement.
- Personal info (name, email): No — there is no login/account.
- Financial info: No — finance/debt entries are user notes stored locally;
  the developer does not collect them. (They may be sent ephemerally to AI
  only when the user taps an AI action — see "Ephemeral" below.)
- Messages / Photos / Videos / Audio files / Contacts: No.
- Location: No — the app does not request location. (AdMob may use coarse
  IP-based location for ad serving; this is covered by the ads disclosure.)

## Data shared

- **YES — shared with Google (AdMob)** for advertising and ad measurement:
  Advertising ID and ad-interaction data.
- No other third-party sharing. User notes are never sold or shared.

## Data processed ephemerally

- **AI features (user-initiated):** when the user taps an AI action
  (summarize, tags, tasks, chat, translate…), the relevant note text is
  sent over HTTPS to our Supabase Edge Function, forwarded to Google
  Gemini, and the result is returned. The content is processed ephemerally
  and is **not stored** by the developer; only token counts, the function
  name, and a salted hash of the IP (for rate limiting) are logged.
- Notes are otherwise stored **locally on the device** only.

## Security practices

- Data is encrypted in transit: **Yes** (HTTPS for all AI requests).
- Users can request data deletion: Yes — local data can be wiped in-app,
  plus the `/delete-data` page and contact email.
- Data deletion contact: zayntahiri1@gmail.com

## Consent

- UMP/GDPR consent form is requested before any ad loads in regulated
  regions (handled in `src/utils/admob.ts`).
- The app is not directed at children under 13
  (`tagForUnderAgeOfConsent: false`).

## Keep in sync

If you later add Firebase Auth / cloud sync, also declare: user IDs and
user-generated content (purpose: app functionality, backup/sync) and keep
encryption + deletion answers truthful.
