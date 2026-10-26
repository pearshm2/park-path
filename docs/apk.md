# Building the Android APK

The APK is an installable version of the app. It talks to the API on Render,
so it works anywhere with internet, with no laptop or Expo Go needed.

Builds run in the cloud on Expo's servers (EAS Build), under the
`hallusynations-team` Expo account. You need to be a member of that team.

## Build a new APK

Do this after app changes (anything in `mobile/`) are merged, so the APK has
them. API changes don't need a new APK: Render deploys those by itself.

```bash
git checkout main
git pull
cd mobile
npx eas-cli@latest login        # first time only; your Expo account
npx eas-cli@latest build --platform android --profile preview
```

It uploads the app and builds it in the cloud: usually 10–30 minutes on the
free plan. You can close the terminal once it's uploaded; the build keeps
going. Progress and the download link are on expo.dev under
**hallusynations-team → park-path → Builds**.

Everything the build needs is already set up in `mobile/eas.json`, including
the Render API address, so there's nothing to change before building.

## Build limits (free plan)

- 15 Android builds a month for the whole `hallusynations-team` account,
  reset on the 1st. A build that fails in its first 3 minutes doesn't count.
- Free builds wait behind paid ones, sometimes for a while: don't leave a
  demo build until the last morning.
- Usage: expo.dev → hallusynations-team → Billing / Usage.

## Install it on a phone

1. Open the build's link (or scan its QR code) on the phone and download it.
2. If Android warns about installing apps from outside the Play Store, allow
   it for your browser.
3. If Google Play Protect says it doesn't recognise the developer, tap
   **More details → Install anyway**.

A new build installs as an update over the old one; data on the phone stays.

## If the build fails

- **At "Install dependencies":** usually the lock file. The build server
  repairs `mobile/package-lock.json` before installing (the
  `eas-build-pre-install` script in `mobile/package.json`), so check that
  script is still there.
- **Says "Generated eas.json" or "EAS project not configured":** you're not
  in `mobile/`, or `mobile/eas.json` / the `projectId` in `mobile/app.json`
  is missing. Stop it with Ctrl+C; a build without them installs but closes
  as soon as it opens (it has no API address).
- **Anything else:** open the failed build on expo.dev and read the red step's
  logs.
