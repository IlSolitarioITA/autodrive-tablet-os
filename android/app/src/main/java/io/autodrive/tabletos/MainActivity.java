package io.autodrive.tabletos;

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
