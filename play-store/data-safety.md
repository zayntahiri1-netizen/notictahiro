# Google Play Data Safety — Answers Matching the SHIPPED App

Version: **1.11.2**

⚠️ These answers describe the app **as actually shipped**: AdMob ads are
enabled (banner, interstitial, app open), Google Analytics is initialized,
and AI features send note content — including voice clips and finance/debt
context — to a secure backend (Supabase Edge Function → Google Gemini).
Declaring less than this is a direct rejection/suspension reason.

## The rule that decides most of this form

Google's Data safety guidance says, in its own words, that off-device data
processed ephemerally **"needs to be included in your form response"** but
**"will not be disclosed in your app's Data safety section on Google Play."**

So "it is only passed through and never stored" is **not** a reason to
answer *No*. It is a reason to answer *Yes* and then tick
**"Data is processed ephemerally"**, which keeps it off the public listing.

A previous version of this file answered *No* for audio and financial
information on exactly that mistaken reasoning. Those were wrong answers.

Separately: transferring data to a **service provider** that processes it on
the developer's instructions is **not** "sharing". Google Gemini, reached
through our own Edge Function for the single purpose of answering the user's
request, is a service provider. So AI processing is declared under
**collection**, not under **sharing**.

## Data collected — answer in Play Console

| Console category | Answer | Collected / Shared | Ephemeral | Optional | Purpose |
|---|---|---|---|---|---|
| Device or other IDs | **Yes** | Collected **and shared** | No | No | Advertising, analytics |
| App interactions | **Yes** | Collected | No | No | Analytics |
| Crash logs / Diagnostics | **Yes** | Collected | No | No | Analytics |
| Audio files — *Voice or sound recordings* | **Yes** | Collected | **Yes** | **Yes** (user-initiated) | App functionality |
| Financial info — *Other financial info* | **Yes** | Collected | **Yes** | **Yes** (user-initiated) | App functionality |
| Files and docs *or* Other user-generated content | **Yes** | Collected | **Yes** | **Yes** (user-initiated) | App functionality |
| Personal info (name, email) | No | — | — | — | No login, no account |
| Contacts | No | — | — | — | No READ_CONTACTS; sharing a reminder uses a `wa.me` / `sms:` link the user taps |
| Location | No | — | — | — | No location permission is requested |
| Health / Messages / Photos / Videos / Calendar | No | — | — | — | Not accessed |

### Why each *Yes* is a *Yes*

- **Device or other IDs** — the AdMob SDK collects the Advertising ID to
  serve and measure ads, and Analytics collects an app instance ID. This is
  also the one entry that is genuinely **shared** (with Google).
- **App interactions / Diagnostics** — Analytics is initialized in two
  layers: the native `firebase-analytics` library added by
  `android-patches/apply-firebase.sh`, and the web SDK in
  `src/utils/firebase.ts` (`getAnalytics`, guarded by `isSupported`).
  The older "YES if Analytics is enabled" was a conditional, not an answer:
  it **is** enabled.
- **Audio files** — `VoiceRecorder.tsx` records to the app's private
  storage, and when online sends the clip through our Edge Function to
  Gemini for transcription. It leaves the device, so it is collected.
- **Other financial info** — finance, debt and budget entries live on the
  device, but AI actions can include them as context in the prompt. The
  moment that can happen, the answer is Yes.
- **Files and docs / Other user content** — same reasoning for note text.

### Not collected, and worth stating plainly

- **Backups** never leave the device: `autoBackup.ts` writes them to the
  app's private storage by default. The user may opt in to the public
  Documents folder; that is device-local too, and nothing is uploaded to our
  servers. Android Auto Backup is configured to **exclude** the backup
  folder and the voice-notes folder
  (`android-patches/apply-backup-rules.sh`).
- **IP address hash** — the Edge Function logs a salted hash of the IP for
  rate limiting. Because the salt is fixed, this is **pseudonymous, not
  anonymous**, and the privacy policy now says so. It is retained only as
  long as abuse prevention and quota enforcement require.

## Data shared

- **Yes — shared with Google** for advertising and ad measurement:
  Advertising ID and ad-interaction data.
- No other third-party sharing. Gemini is a service provider (see above).
  User content is never sold.

## Security practices

- Data is encrypted in transit: **Yes** (HTTPS for every AI request).
- Users can request data deletion: **Yes**.
  - In-app: the `/delete-data` page, behind a two-step confirmation, erases
    `localStorage`, `sessionStorage`, Capacitor `Preferences`, the
    `voice-notes` folder, **every backup in both storage locations**, and
    **cancels every scheduled notification**.
  - Public URL: <https://notictahiro.web.app/delete-data>
  - By email: zayntahiri1@gmail.com
- Before 1.11.2 that button cleared only `localStorage` and
  `sessionStorage`, so backups, voice clips and scheduled reminders survived
  a "deletion" the app reported as complete. Answering *Yes* to the deletion
  question was inaccurate until this release.

## Consent (ads)

- UMP consent is requested on every launch, and no ad is requested unless
  the gate is open.
- On a consent **error or timeout** the app falls back to the decision
  stored from a previous session; if no decision was ever obtained, **no
  ads are requested** in that session. Before 1.11.2 both paths assumed
  consent, so a failure to reach the consent service produced the same
  outcome as a granted consent.
- The app is not directed at children under 13
  (`tagForUnderAgeOfConsent: false`).

## Still to do by hand in Play Console

1. Transcribe the table above into **App content → Data safety**.
2. **App content → Privacy policy**: <https://notictahiro.web.app/privacy>
3. **Ads**: declare *Contains ads*.
4. **Foreground service** (`specialUse`, the floating bubble): confirm the
   declaration and the demo video are on file.
5. **Trader status** (DSA): complete the declaration.
6. `app-ads.txt` must be reachable at the developer website entered in AdMob.

## Keep in sync

If you later add Firebase Auth or cloud sync, also declare user IDs and
user-generated content (purpose: app functionality, backup/sync) as
**collected and stored**, drop the ephemeral tick for anything persisted
server-side, and keep the encryption and deletion answers truthful.
