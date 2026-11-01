package io.autodrive.tabletos;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private WebView webView;
    private BroadcastReceiver whatsappReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Mantieni lo schermo acceso durante l'utilizzo in auto
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

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
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (url != null && "autodrive.local".equals(url.getHost())) {
                    String path = url.getPath();
                    if (path == null || path.equals("/") || !path.contains(".")) {
                        path = "/index.html";
                    }
                    String assetPath = "public" + path;
                    String mime = getMimeType(path);
                    try {
                        InputStream is = getAssets().open(assetPath);
                        return new WebResourceResponse(mime, "UTF-8", is);
                    } catch (Exception e) {
                        try {
                            InputStream fallback = getAssets().open("public/index.html");
                            return new WebResourceResponse("text/html", "UTF-8", fallback);
                        } catch (Exception ignored) {}
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("intent:") || url.startsWith("google.navigation:")) {
                    try {
                        Intent intent = url.startsWith("intent:")
                            ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                            : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    } catch (Exception e) {
                        // Fallback se l'app non è installata
                    }
                    return true;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                request.grant(request.getResources());
            }
        });

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

        webView.loadUrl("https://autodrive.local/index.html");
    }

    private String getMimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        return "application/octet-stream";
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (whatsappReceiver != null) {
            unregisterReceiver(whatsappReceiver);
        }
        super.onDestroy();
    }
}
