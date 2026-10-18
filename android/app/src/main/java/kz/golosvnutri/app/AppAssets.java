package kz.golosvnutri.app;

import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;

import androidx.webkit.WebViewAssetLoader;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Отдаёт собранный сайт из assets/web. Как обычный хостинг: адрес папки
 * («care/») открывает её index.html, у каждого файла правильный тип.
 */
final class AppAssets implements WebViewAssetLoader.PathHandler {
    private static final Map<String, String> TYPES = new HashMap<>();

    static {
        TYPES.put("html", "text/html");
        TYPES.put("js", "text/javascript");
        TYPES.put("mjs", "text/javascript");
        TYPES.put("css", "text/css");
        TYPES.put("json", "application/json");
        TYPES.put("webmanifest", "application/manifest+json");
        TYPES.put("svg", "image/svg+xml");
        TYPES.put("png", "image/png");
        TYPES.put("jpg", "image/jpeg");
        TYPES.put("ico", "image/x-icon");
        TYPES.put("woff", "font/woff");
        TYPES.put("woff2", "font/woff2");
        TYPES.put("wasm", "application/wasm");
        TYPES.put("txt", "text/plain");
    }

    private final AssetManager assets;

    AppAssets(AssetManager assets) {
        this.assets = assets;
    }

    @Override
    public WebResourceResponse handle(String path) {
        String file = path;
        int slash = file.lastIndexOf('/');
        if (file.isEmpty() || file.endsWith("/")) file += "index.html";
        else if (!file.substring(slash + 1).contains(".")) file += "/index.html";
        String ext = file.substring(file.lastIndexOf('.') + 1).toLowerCase();
        String type = TYPES.containsKey(ext) ? TYPES.get(ext) : "application/octet-stream";
        boolean text = type.startsWith("text/") || type.endsWith("json") || type.endsWith("xml");
        try {
            InputStream in = assets.open("web/" + file);
            return new WebResourceResponse(type, text ? "utf-8" : null, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
        }
    }
}
