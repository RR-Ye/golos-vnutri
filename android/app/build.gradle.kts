// Оболочка Android: WebView показывает собранное приложение из assets/web, без сети.
plugins {
    id("com.android.application")
}

// Номер сборки растёт с каждым запуском CI — новая версия ставится поверх старой, данные остаются.
val build = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "kz.golosvnutri.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "kz.golosvnutri.app"
        minSdk = 26
        targetSdk = 34
        versionCode = build
        versionName = "1.0.$build"
    }

    // Ключ подписи. Тестовый ключ лежит в репозитории, чтобы обновления ставились поверх
    // без удаления данных. Для постоянного ключа CI берёт его из секретов (см. README).
    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("ANDROID_KEYSTORE_FILE") ?: "../golos-test.jks")
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: "golos-test"
            keyAlias = System.getenv("ANDROID_KEY_ALIAS") ?: "golos"
            keyPassword = System.getenv("ANDROID_KEY_PASSWORD") ?: "golos-test"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        // Модели голоса и WASM читаются быстрее несжатыми.
        noCompress += listOf("onnx", "wasm", "data")
        // По умолчанию в APK не попадают папки на «_», а весь код сайта лежит в _next/.
        ignoreAssetsPattern = "!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~"
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
