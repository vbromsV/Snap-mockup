plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Versionsnummer: GitHub sätter ett nytt nummer för varje bygge
val buildNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "app.snapmockup"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.snapmockup"
        minSdk = 29
        targetSdk = 34
        versionCode = buildNumber
        versionName = "1.$buildNumber"
    }

    // Samma nyckel varje gång, så att nya versioner kan installeras ovanpå de gamla
    signingConfigs {
        create("app") {
            storeFile = file("snapmockup.keystore")
            storePassword = "snapmockup"
            keyAlias = "snapmockup"
            keyPassword = "snapmockup"
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("app")
        }
        getByName("debug") {
            signingConfig = signingConfigs.getByName("app")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
