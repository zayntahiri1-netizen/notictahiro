# Permissions Declaration Guidance

Notic Tahiro should request only permissions that are needed by enabled features.

## Recommended permissions for current app

### Notifications

Use only if real reminders/local notifications are enabled.

- Android 13+: `POST_NOTIFICATIONS`
- Also shipped: `SCHEDULE_EXACT_ALARM` (precise note alarms) and
  `RECEIVE_BOOT_COMPLETED` (reschedule reminders after device restart).
- Purpose: remind users of notes, debt due dates, daily reminders, and proactive alarms.
- Request timing: only when the user creates or enables a reminder.

### Microphone (shipped — voice input)

- `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` are declared in the manifest
  (added by `android-patches/apply-admob.sh`).
- Purpose: user-initiated voice-to-text note input (Moroccan Arabic first).
- Request timing: only when the user taps the microphone button; never in
  the background. iOS equivalents are injected by
  `ios-patches/apply-ios-config.sh`.

Play Console declaration text example:

> Notic Tahiro uses the microphone only when the user taps the voice input
> button, to convert speech into note text on-device/via the system speech
> service. No background recording occurs.

### Clipboard

Clipboard access should be user-initiated.

- Purpose: Smart Clipboard feature.
- Best practice: show user action button such as "Read clipboard" or explain why clipboard is read.

### Filesystem

Use only if export/import or file attachment feature is actually enabled.

- Purpose: export notes, reports, PDFs, backups.
- Avoid broad storage permissions if possible.

### Haptics / Keyboard / App

Usually do not require dangerous permissions.

## Permissions to avoid unless shipped and justified

- Background location
- Contacts
- SMS
- Call logs
- Microphone continuous background recording
- Manage external storage

## Play Console declaration text example

If notifications are used:

> Notic Tahiro uses notifications only to remind users about notes, tasks, due debts, and user-created reminders. Users can disable reminders at any time inside the app or through Android settings.

If clipboard is used:

> Clipboard access is used only to help users save copied text into notes or finance records when they intentionally use the Smart Clipboard feature.