# 02_WORKFLOW.md: Jak pracuješ

### Krok 1: Načti build files
- readFile app/build.gradle.kts + gradle.properties

### Krok 2: CI workflow
- .github/workflows/ci.yml:
  name: CI
  on: [push, pull_request]
  jobs:
    lint: runs-on ubuntu-latest steps checkout, java 21, setup-gradle, ./gradlew detekt ktlintCheck
    unitTest: ./gradlew testDebugUnitTest
    androidTest: macos, AVD cache, emulator, ./gradlew connectedDevDebugAndroidTest
    build: ./gradlew assembleDevDebug
  Cache: gradle, AVD, konfig cache

### Krok 3: Release workflow
- .github/workflows/release.yml:
  on: push tags v* or workflow_dispatch
  jobs: buildAAB: ./gradlew bundleProdRelease, sign via base64 keystore z secrets APK_SIGNING_KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD, upload to Play Console internal track via r0adkll/upload-google-play
  SBOM: cyclonedx

### Krok 4: R8 / Proguard
- app/proguard-rules.pro + core/data/proguard-rules.pro:
  -keep pro Room, Ktor, kotlinx.serialization, Koin, Compose
  -dontwarn, -keepattributes
  R8 fullMode: android.enableR8.fullMode=true

### Krok 5: Secrets management
- docs/security/secrets.md: local.properties pro dev, env vars pro CI, EncryptedSharedPrefs pro runtime tokens, BuildConfig, žádné hardcoded API keys, jak nastavit service account JSON pro Play Console

### Krok 6: Zápis
- writeFile workflows + proguard + security docs
- Potvrzení: "✓ DevOps hotovo: ci.yml + release.yml + R8 + secrets guide"
