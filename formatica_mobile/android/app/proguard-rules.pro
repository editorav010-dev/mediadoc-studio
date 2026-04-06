-keep public class com.itextpdf.**
-keep public class org.apache.**
-keep class com.antonkarpenko.ffmpegkit.** { *; }

# WebView - prevent R8 from stripping WebView provider classes
-keep class android.webkit.** { *; }
-keep class com.google.android.webview.** { *; }
-keep class org.chromium.** { *; }

# Flutter WebView plugin
-keep class io.flutter.plugins.webviewflutter.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
