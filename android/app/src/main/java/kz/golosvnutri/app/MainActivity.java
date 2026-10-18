package kz.golosvnutri.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Arrays;

/**
 * «Голос внутри» для Android: тот же сайт, только все файлы лежат внутри APK
 * (assets/web) и отдаются по адресу https://appassets.androidplatform.net/app/.
 * В сеть приложение не ходит.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/app/";
    private static final int FILE_REQUEST = 1;
    private static final int MIC_REQUEST = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest micRequest;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // Экран не гаснет, пока приложение открыто.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Отладочная сборка открывает WebView для автотеста на эмуляторе.
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/app/", new AppAssets(getAssets()))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Никаких переходов на чужие сайты.
                return !HOST.equals(request.getUrl().getHost());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> onMicRequest(request));
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return openFileChooser(callback, params);
            }
        });

        web.addJavascriptInterface(new Bridge(), "GolosAndroid");

        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** Весь экран под приложение: системные панели появляются только по свайпу от края. */
    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    // Микрофон: страница просит доступ, Android спрашивает разрешение один раз.
    private void onMicRequest(PermissionRequest request) {
        boolean wantsAudio = Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
        if (!wantsAudio) {
            request.deny();
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            micRequest = request;
            requestPermissions(new String[] {Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code != MIC_REQUEST || micRequest == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            micRequest.grant(new String[] {PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        } else {
            micRequest.deny();
        }
        micRequest = null;
    }

    // Выбор файла: фото для анкеты и файл резервной копии.
    private boolean openFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = callback;
        boolean images = false;
        for (String t : params.getAcceptTypes()) if (t != null && t.startsWith("image/")) images = true;
        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        // .golos — не тип файла для Android, поэтому для копии разрешаем любой файл.
        pick.setType(images ? "image/*" : "*/*");
        try {
            startActivityForResult(Intent.createChooser(pick, null), FILE_REQUEST);
            return true;
        } catch (ActivityNotFoundException e) {
            fileCallback = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != FILE_REQUEST || fileCallback == null) return;
        fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        fileCallback = null;
    }

    /** Мост для страницы: сохранить резервную копию в «Загрузки». */
    private class Bridge {
        @JavascriptInterface
        public String saveFile(String name, String mime, String base64) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String where;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    v.put(MediaStore.Downloads.MIME_TYPE, mime);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IllegalStateException("no uri");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        if (out == null) throw new IllegalStateException("no stream");
                        out.write(bytes);
                    }
                    where = getString(R.string.saved, name);
                } else {
                    // До Android 10 общая папка требует отдельного разрешения — кладём в папку приложения.
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File file = new File(dir, name);
                    try (OutputStream out = new FileOutputStream(file)) {
                        out.write(bytes);
                    }
                    where = getString(R.string.saved_app_dir, file.getAbsolutePath());
                }
                final String message = where;
                runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
                return "ok";
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, R.string.save_failed, Toast.LENGTH_LONG).show());
                return "error: " + e.getMessage();
            }
        }
    }
}
