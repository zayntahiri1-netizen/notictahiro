
## أذونات الميكروفون (مطلوبة للتسجيل الصوتي)

أضف في android/app/src/main/AndroidManifest.xml قبل <application>:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
```
