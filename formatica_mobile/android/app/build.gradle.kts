plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.formatica.formatica_mobile"
    compileSdk = 36  // Required by androidx.browser:1.9.0 and androidx.core:1.17.0
    ndkVersion = flutter.ndkVersion

    packaging {
        jniLibs {
            useLegacyPackaging = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.formatica.formatica_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 24
        targetSdk = 34
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
            // Temporarily disabled for initial build success
            isMinifyEnabled = false
            isShrinkResources = false
            // proguardFiles(
            //     getDefaultProguardFile("proguard-android-optimize.txt"),
            //     "proguard-rules.pro",
            // )
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Apache POI for Microsoft Office format parsing
    // Version 5.2.3 is the last version supporting Android API 24+
    // Version 5.2.4+ requires API 26+ due to MethodHandle usage
    implementation("org.apache.poi:poi:5.2.3")              // HSSF (XLS) and common POI classes
    implementation("org.apache.poi:poi-ooxml:5.2.3")        // XSSF (XLSX) and OOXML support
    implementation("org.apache.poi:poi-scratchpad:5.2.3")   // HSLF (PPT) and legacy format support
    
    // AndroidX constraints (already included, but explicit for clarity)
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
}
