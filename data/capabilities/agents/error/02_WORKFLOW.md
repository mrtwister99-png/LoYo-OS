# 02_WORKFLOW.md: Jak pracuješ

### Krok 1: Načti architekturu
- readFile docs/ARCHITECTURE.md + MODULES.md

### Krok 2: Version Catalog
- Vytvoř gradle/libs.versions.toml:
[versions] kotlin=2.1.20, agp=8.7.3, ksp=2.1.20-1.0.31, compose-bom=2026.05.00, koin=4.0.4, ktor=3.1.2, room=2.6.1, coroutines=1.8.1, serialization=1.7.3, lifecycle=2.8.6
[libraries] definice pro všechny
[plugins] kotlin-jvm, kotlin-serialization, ksp, android-application, android-library, compose-compiler

### Krok 3: build-logic convention
- build-logic/settings.gradle.kts + build.gradle.kts
- convention/src/main/kotlin/android-library.gradle.kts: plugins { android-library, kotlin-android, ksp }, android { compileSdk 35, minSdk 24, compose true }, dependencies { implementation(libs) }
- android-application.gradle.kts: application, buildTypes, flavors
- kotlin-library.gradle.kts: pure Kotlin

### Krok 4: Root + app build
- settings.gradle.kts: pluginManagement, dependencyResolutionManagement, include(":app", ":core:domain", ":core:data", ":core:ui", ":feature:...")
- build.gradle.kts root: plugins false
- gradle.properties: parallel, caching, nonTransitiveRClass, useAndroidX, ksp.incremental
- app/build.gradle.kts: plugins { convention.android-application }, android { namespace, compileSdk, defaultConfig { applicationId, versionCode, versionName }, buildTypes { debug, release { isMinifyEnabled=true, proguardFiles } }, flavorDimensions "env" { dev { applicationIdSuffix ".dev" }, prod } }, dependencies { implementation projects }

### Krok 5: KMP pokud potřeba
- commonMain, androidMain, iosMain source sets
- expect/actual pro platform věci

### Krok 6: Zápis a validace
- writeFile vše
- Ověř že ./gradlew build --dry-run projde (simulace)
- Potvrzení: "✓ Build hotovo: libs.versions.toml 2026, convention plugins, flavors dev/prod, KMP ready"
