import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import '../services/local_server.dart';
import '../services/pandoc_bridge.dart';
import '../services/pandoc_initializer.dart';

class PandocBridgeView extends StatefulWidget {
  const PandocBridgeView({
    super.key,
    required this.controller,
  });

  final PandocBridgeController controller;

  @override
  State<PandocBridgeView> createState() => _PandocBridgeViewState();
}

class _PandocBridgeViewState extends State<PandocBridgeView> {
  late final WebViewController _webViewController;

  @override
  void initState() {
    super.initState();
    late final PlatformWebViewControllerCreationParams params;
    if (WebViewPlatform.instance is WebKitWebViewPlatform) {
      params = WebKitWebViewControllerCreationParams(
        allowsInlineMediaPlayback: true,
        mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
      );
    } else {
      params = const PlatformWebViewControllerCreationParams();
    }

    _webViewController = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            widget.controller.reportStatus('Loading bundled Pandoc engine...');
          },
          onPageFinished: (_) {
            widget.controller
                .reportStatus('Initializing bundled Pandoc runtime...');
          },
          onWebResourceError: (error) {
            debugPrint('WEB RESOURCE ERROR: ${error.errorCode} - ${error.description}');
            widget.controller.reportFatalError(
              'Bundled Pandoc assets failed to load: ${error.description} (Code: ${error.errorCode})',
            );
          },
        ),
      )
      ..setOnConsoleMessage((message) {
        debugPrint('PandocBridgeView ${message.level}: ${message.message}');
      })
      ..addJavaScriptChannel(
        'PandocBridge',
        onMessageReceived: (message) {
          widget.controller.handleJavaScriptMessage(message.message);
        },
      );

    // Platform-specific configuration for Android
    if (_webViewController.platform is AndroidWebViewController) {
      if (kDebugMode) {
        AndroidWebViewController.enableDebugging(true);
      }
      (_webViewController.platform as AndroidWebViewController)
        ..setMediaPlaybackRequiresUserGesture(false)
        ..setAllowFileAccess(true)
        ..setAllowContentAccess(true);
    }

    _initWebView();
    widget.controller.attach(_webViewController);
  }

  Future<void> _initWebView() async {
    try {
      debugPrint('PandocBridgeView: Initializing...');
      final localPath = await PandocInitializer().ensureInitialized();
      debugPrint('PandocBridgeView: localPath = $localPath');
      // Get the directory containing bridge.html
      final assetsDir = p.dirname(localPath);
      debugPrint('PandocBridgeView: assetsDir = $assetsDir');
      // Start local HTTP server to serve assets
      final baseUrl = await LocalAssetServer().start(assetsDir);
      debugPrint('PandocBridgeView: baseUrl = $baseUrl');
      // Load via HTTP instead of file:// to allow ES6 module imports
      final url = '$baseUrl/bridge.html';
      debugPrint('PandocBridgeView: Loading URL: $url');
      await _webViewController.loadRequest(Uri.parse(url));
    } catch (e) {
      debugPrint('PandocBridgeView: Initialization error: $e');
      widget.controller.reportFatalError('Failed to initialize Pandoc engine: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Opacity(
        opacity: 0.01,
        child: SizedBox.expand(
          child: WebViewWidget(controller: _webViewController),
        ),
      ),
    );
  }
}
