# Raseed Android app

This Android shell opens the existing Raseed store at:
https://technosell.cncabtan.prod.page/

It does not duplicate the store backend or change the production website.

## Build

The GitHub Actions workflow `.github/workflows/android-apk.yml` builds a debug APK on pushes to the `android-app` branch or by manual dispatch.

The generated APK is uploaded as the workflow artifact named `raseed-android-debug-apk`.

## Important testing notes

- This first build is an installable **debug APK** for device testing, not a Play Store release.
- Test account creation, sign-in/out, wallet, product browsing, and orders on a real Android phone.
- Google sign-in may require a native/system-browser authentication flow because Google blocks some embedded WebView OAuth flows. If it fails in the APK, implement and test a native sign-in handoff before release.
- A signed release build and Play App Signing setup are separate steps. Never commit signing keys or passwords.
