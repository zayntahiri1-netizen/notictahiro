# Google Play Release Checklist

Use this checklist before sending Notic Tahiro to review.

## 1. App identity

- [ ] App name in Play Console: Notic Tahiro
- [ ] Package name: com.notictahiro.app
- [ ] App category: Productivity
- [ ] Contact email: zayntahiri1@gmail.com
- [ ] App icon uploaded in Play Console: 512 x 512 PNG
- [ ] Feature graphic uploaded: 1024 x 500 PNG/JPG
- [ ] Screenshots uploaded for phone, 7-inch tablet, and 10-inch tablet if supported

## 2. Build and signing

- [ ] Use Android App Bundle `.aab`, not APK for production
- [ ] Upload App Signing enabled in Play Console
- [ ] GitHub Actions secrets configured:
- [ ] `ANDROID_KEYSTORE_BASE64`
- [ ] `ANDROID_KEYSTORE_PASSWORD`
- [ ] `ANDROID_KEY_ALIAS`
- [ ] `ANDROID_KEY_PASSWORD`
- [ ] Release built from clean repository

## 3. Privacy and data deletion

- [ ] Public privacy policy URL works on HTTPS
- [ ] Public delete-data URL works on HTTPS
- [ ] Privacy policy mentions local storage, AI processing, financial organizer disclaimer, contact email
- [ ] Delete-data page explains how users can delete local data
- [ ] If login/cloud sync is added later, account deletion must be available in-app and on web

## 4. Data Safety form

- [ ] Data collection declarations match actual behavior
- [ ] Data sharing declarations match actual behavior
- [ ] Security practices are truthful
- [ ] Data deletion method is declared

## 5. Permissions

- [ ] Only request permissions that are actually used
- [ ] Notifications permission is requested only when needed
- [ ] No background location permission unless a real location-reminder feature is shipped and justified
- [ ] No SMS/Contacts/Call Log permissions
- [ ] No broad storage permission unless absolutely required

## 6. Ads and monetization

- [ ] If no ads are used, select: No ads in Play Console
- [ ] If AdMob is added later, add app-ads.txt on verified website
- [ ] Do not place ads near buttons or accidental tap areas
- [ ] Do not incentivize ad clicks
- [ ] Add consent flow for EEA/UK if personalized ads or analytics are used

## 7. AI and finance disclaimers

- [ ] AI features are described as assistance, not guaranteed truth
- [ ] Financial/debt features are described as personal organization tools only
- [ ] Crypto/investment comparisons are neutral and educational only
- [ ] No promises of profit or investment advice

## 8. Content rating

- [ ] Complete Play Console content rating questionnaire accurately
- [ ] App is not directed to children under 13
- [ ] If children are targeted later, review Families Policy

## 9. Testing

- [ ] Test install from Internal Testing track
- [ ] Test first launch
- [ ] Test privacy pages and delete-data route
- [ ] Test dark/light mode
- [ ] Test language switcher
- [ ] Test local notes creation/edit/delete
- [ ] Test app on small phone, large phone, tablet
- [ ] Test offline behavior

## 10. Final review

- [ ] Store listing does not exaggerate AI capabilities
- [ ] Screenshots match the actual app
- [ ] Privacy policy matches Data Safety form
- [ ] No hidden API keys in frontend
- [ ] App does not crash on startup