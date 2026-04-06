import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;

/// A lightweight local HTTP server that serves Pandoc assets.
/// 
/// This is needed because Android WebView blocks ES6 module imports
/// (type="module") from file:// URIs due to CORS/same-origin restrictions.
/// By serving the assets via HTTP on localhost, the WebView can properly
/// load the ES6 modules.
class LocalAssetServer {
  static final LocalAssetServer _instance = LocalAssetServer._internal();
  factory LocalAssetServer() => _instance;
  LocalAssetServer._internal();

  HttpServer? _server;
  String? _baseUrl;
  String? _assetsPath;

  /// Returns the base URL (e.g., http://localhost:8089) if server is running.
  String? get baseUrl => _baseUrl;

  /// Starts the local HTTP server serving files from [assetsPath].
  /// 
  /// Returns the base URL (e.g., http://localhost:8089).
  /// If the server is already running, returns the existing base URL.
  Future<String> start(String assetsPath) async {
    if (_server != null && _baseUrl != null) {
      return _baseUrl!;
    }

    _assetsPath = assetsPath;
    debugPrint('LocalServer: Starting server with assetsPath: $assetsPath');
    
    // Bind to loopback on a random available port
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _baseUrl = 'http://localhost:${_server!.port}';
    
    _server!.listen(_handleRequest);
    
    debugPrint('LocalServer: Server started at $_baseUrl');
    return _baseUrl!;
  }

  /// Handles incoming HTTP requests.
  void _handleRequest(HttpRequest request) async {
    try {
      // Normalize the path - root serves bridge.html
      String filePath = request.uri.path;
      if (filePath == '/' || filePath.isEmpty) {
        filePath = '/bridge.html';
      }
      
      // Remove leading slash and build full path
      final relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      final fullPath = p.join(_assetsPath!, relativePath);
      final file = File(fullPath);
      
      // Debug logging
      final exists = await file.exists();
      debugPrint('LocalServer: ${request.method} ${request.uri.path} -> $fullPath (exists: $exists)');
      
      if (exists) {
        final ext = p.extension(filePath).toLowerCase();
        final contentType = _getContentType(ext);
        
        request.response.headers.set('Content-Type', contentType);
        request.response.headers.set('Access-Control-Allow-Origin', '*');
        request.response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        request.response.headers.set('Access-Control-Allow-Headers', '*');
        
        // Handle preflight requests
        if (request.method == 'OPTIONS') {
          request.response.statusCode = HttpStatus.ok;
          await request.response.close();
          return;
        }
        
        await file.openRead().pipe(request.response);
        debugPrint('LocalServer: Served ${request.uri.path} successfully');
      } else {
        debugPrint('LocalServer: File not found: $fullPath');
        request.response.statusCode = HttpStatus.notFound;
        await request.response.close();
      }
    } catch (e) {
      debugPrint('LocalServer: Error handling request: $e');
      request.response.statusCode = HttpStatus.internalServerError;
      await request.response.close();
    }
  }

  /// Returns the appropriate MIME type for the file extension.
  String _getContentType(String ext) {
    switch (ext) {
      case '.html':
        return 'text/html; charset=utf-8';
      case '.js':
        return 'application/javascript; charset=utf-8';
      case '.wasm':
        return 'application/wasm';
      case '.json':
        return 'application/json; charset=utf-8';
      case '.css':
        return 'text/css; charset=utf-8';
      default:
        return 'application/octet-stream';
    }
  }

  /// Stops the HTTP server if it's running.
  Future<void> stop() async {
    await _server?.close();
    _server = null;
    _baseUrl = null;
    _assetsPath = null;
  }

  /// Returns true if the server is currently running.
  bool get isRunning => _server != null;
}
