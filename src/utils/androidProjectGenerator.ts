/**
 * Complete, compilable Android Native Project (Gradle + AndroidX WebKit + Native Metrolist Intents + WhatsApp NotificationListenerService)
 * When pushed to GitHub or opened in Android Studio, compiles into a signed, installable AutoDrive-Tablet-OS.apk.
 */

export interface AndroidProjectFile {
  path: string;
  description: string;
  content: string;
}

export function getCompleteAndroidProjectFiles(): AndroidProjectFile[] {
  return [
    {
      path: 'android/settings.gradle',
      description: 'Configurazione repository Gradle per Android SDK 34',
      content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "AutoDriveTabletOS"
include ':app'
`,
    },
    {
      path: 'android/build.gradle',
      description: 'Root build.gradle con Android Gradle Plugin 8.2.2',
      content: `plugins {
    id 'com.android.application' version '8.2.2' apply false
}
`,
    },
    {
      path: 'android/gradle.properties',
      description: 'Proprietà JVM e AndroidX per compilazione APK',
      content: `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
`,
    },
    {
      path: 'android/app/build.gradle',
      description: 'Configurazione modulo app Android con firma automatica APK',
      content: `plugins {
    id 'com.android.application'
}

android {
    namespace 'io.autodrive.tabletos'
    compileSdk 34

    defaultConfig {
        applicationId "io.autodrive.tabletos"
        minSdk 26
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }

    buildTypes {
        debug {
            debuggable true
        }
        release {
            minifyEnabled false
            // Firma automaticamente con chiave debug così l'APK è subito installabile sul telefono/tablet
            signingConfig signingConfigs.debug
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.webkit:webkit:1.10.0'
}
`,
    },
    {
      path: 'android/app/src/main/AndroidManifest.xml',
      description: 'Manifest Android con permessi GPS, Microfono, Metrolist <queries> e WhatsApp NotificationListener',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permessi Hardware Reali (GPS, Microfono Comandi Vocali, Rete, Bluetooth) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

    <!-- Visibilità Pacchetti Esterni Android 11+ (Metrolist, VLC, Spotify, WhatsApp, Google Maps) -->
    <queries>
        <package android:name="com.metrolist.music" />
        <package android:name="com.moagamy.metrolist" />
        <package android:name="org.videolan.vlc" />
        <package android:name="com.spotify.music" />
        <package android:name="com.maxmpz.audioplayer" />
        <package android:name="com.whatsapp" />
        <package android:name="com.google.android.apps.maps" />
        <intent>
            <action android:name="android.media.action.MEDIA_PLAY_FROM_SEARCH" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="google.navigation" />
        </intent>
    </queries>

    <application
        android:allowBackup="true"
        android:label="AutoDrive Tablet OS"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar.Fullscreen">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="sensorLandscape"
            android:launchMode="singleTask"
            android:configChanges="orientation|screenSize|keyboardHidden|uiMode">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <category android:name="android.intent.category.HOME" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>

        <!-- Servizio Nativo per Ricezione Notifiche WhatsApp Reali -->
        <service
            android:name=".WhatsAppNotificationService"
            android:label="AutoDrive WhatsApp Bridge"
            android:exported="true"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
    </application>
</manifest>
`,
    },
    {
      path: 'android/app/src/main/java/io/autodrive/tabletos/MainActivity.java',
      description: 'Activity nativa Android a schermo intero che esegue l’app offline e lancia gli Intent di Metrolist e Google Maps',
      content: `package io.autodrive.tabletos;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView webView;
    private BroadcastReceiver whatsappReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Mantieni lo schermo sempre acceso durante la guida in auto
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUI();

        // Richiedi subito i permessi GPS e Microfono all'avvio dell'APK
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            requestPermissions(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.RECORD_AUDIO
            }, 1001);
        }

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);

        // Carica il bundle compilato (dist/) direttamente dagli assets interni dell'APK su dominio sicuro https://
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("appassets.androidplatform.net".equals(url.getHost())) {
                    String path = url.getPath();
                    if (path == null || path.equals("/") || !path.contains(".")) {
                        return assetLoader.shouldInterceptRequest(
                            Uri.parse("https://appassets.androidplatform.net/assets/public/index.html")
                        );
                    }
                    if (!path.startsWith("/assets/")) {
                        return assetLoader.shouldInterceptRequest(
                            Uri.parse("https://appassets.androidplatform.net/assets/public" + path)
                        );
                    }
                }
                return assetLoader.shouldInterceptRequest(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Gestione nativa degli Intent Android (Metrolist, VLC, Google Maps, WhatsApp)
                if (url.startsWith("intent:") || url.startsWith("google.navigation:")) {
                    try {
                        Intent intent = url.startsWith("intent:")
                            ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                            : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception ignored) {
                        // Se il pacchetto specifico non risponde, prova ad aprire il package direttamente
                    }
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                // Concede automaticamente il GPS reale all'interfaccia di guida
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Concede automaticamente il microfono per i comandi vocali
                request.grant(request.getResources());
            }
        });

        // Ricevitore per notifiche WhatsApp reali intercettate dal servizio nativo
        whatsappReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                try {
                    String sender = intent.getStringExtra("sender");
                    String text = intent.getStringExtra("text");
                    JSONObject obj = new JSONObject();
                    obj.put("senderName", sender != null ? sender : "WhatsApp");
                    obj.put("text", text != null ? text : "");
                    final String js = "window.dispatchEvent(new CustomEvent('autodrive-native-whatsapp', { detail: " + obj.toString() + " }));";
                    webView.post(() -> webView.evaluateJavascript(js, null));
                } catch (Exception ignored) {}
            }
        };

        IntentFilter filter = new IntentFilter("io.autodrive.tabletos.WHATSAPP_NOTIFICATION");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(whatsappReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(whatsappReceiver, filter);
        }

        webView.loadUrl("https://appassets.androidplatform.net/assets/public/index.html");
    }

    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    protected void onDestroy() {
        if (whatsappReceiver != null) {
            unregisterReceiver(whatsappReceiver);
        }
        super.onDestroy();
    }
}
`,
    },
    {
      path: 'android/app/src/main/java/io/autodrive/tabletos/WhatsAppNotificationService.java',
      description: 'Servizio Android NotificationListenerService per leggere i messaggi WhatsApp reali',
      content: `package io.autodrive.tabletos;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class WhatsAppNotificationService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        if (!"com.whatsapp".equals(pkg) && !"com.whatsapp.w4b".equals(pkg)) {
            return;
        }
        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) return;

        Bundle extras = notification.extras;
        CharSequence titleObj = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textObj = extras.getCharSequence(Notification.EXTRA_TEXT);

        if (titleObj != null && textObj != null) {
            Intent broadcast = new Intent("io.autodrive.tabletos.WHATSAPP_NOTIFICATION");
            broadcast.setPackage(getPackageName());
            broadcast.putExtra("sender", titleObj.toString());
            broadcast.putExtra("text", textObj.toString());
            sendBroadcast(broadcast);
        }
    }
}
`,
    },
    {
      path: '.github/workflows/release-apk.yml',
      description: 'Workflow GitHub Actions che compila automaticamente il file AutoDrive-Tablet-OS.apk senza bisogno di Android Studio sul PC',
      content: `name: Build AutoDrive Android APK

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-android-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout codice sorgente
        uses: actions/checkout@v4

      - name: Configura Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Configura Java 17 per Android SDK
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Installa dipendenze e compila Web Bundle (dist)
        run: |
          npm install
          npm run build
          mkdir -p android/app/src/main/assets/public
          cp -r dist/* android/app/src/main/assets/public/

      - name: Configura Gradle 8.7 e compila APK firmato
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.7'
      - name: Genera AutoDrive-Tablet-OS.apk
        working-directory: android
        run: gradle assembleRelease

      - name: Rinonima APK pronto per il download
        run: |
          cp android/app/build/outputs/apk/release/app-release.apk ./AutoDrive-Tablet-OS.apk

      - name: Carica APK negli Artifacts scaricabili
        uses: actions/upload-artifact@v4
        with:
          name: AutoDrive-Tablet-OS-APK
          path: ./AutoDrive-Tablet-OS.apk

      - name: Pubblica APK nella sezione Releases di GitHub
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v1.0.\${{ github.run_number }}
          name: "AutoDrive Tablet OS v1.0.\${{ github.run_number }} (APK Android)"
          body: "Scarica il file **AutoDrive-Tablet-OS.apk** qui sotto e aprilo sul tuo telefono o tablet Android per installare l'applicazione nativa completa."
          files: ./AutoDrive-Tablet-OS.apk
`,
    },
  ];
}
