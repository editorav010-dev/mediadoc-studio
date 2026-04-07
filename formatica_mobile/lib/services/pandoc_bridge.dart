import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:webview_flutter/webview_flutter.dart';

class PandocBridgeController extends ChangeNotifier {
  static const int _inputChunkSize = 500000;  // 500KB chunks (increased from 180KB for better performance)

  final Completer<void> _readyCompleter = Completer<void>();
  final Map<String, _PendingPandocRequest> _pendingRequests = {};

  WebViewController? _webViewController;
  bool _isReady = false;
  String _statusMessage = 'Loading bundled Pandoc engine...';
  String? _version;
  String? _fatalError;

  bool get isReady => _isReady;
  String get statusMessage => _fatalError ?? _statusMessage;
  String? get version => _version;
  String? get fatalError => _fatalError;

  void attach(WebViewController controller) {
    _webViewController = controller;
  }

  void reportStatus(String message) {
    if (_fatalError != null) {
      return;
    }
    _statusMessage = message;
    notifyListeners();
  }

  void reportFatalError(String message) {
    _fatalError = message;
    _statusMessage = message;
    if (!_readyCompleter.isCompleted) {
      _readyCompleter.completeError(Exception(message));
    }
    for (final pending in _pendingRequests.values) {
      if (!pending.completer.isCompleted) {
        pending.completer.completeError(Exception(message));
      }
    }
    _pendingRequests.clear();
    notifyListeners();
  }

  Future<void> ensureReady() async {
    if (_fatalError != null) {
      throw Exception(_fatalError);
    }
    if (_isReady) {
      return;
    }

    await _readyCompleter.future.timeout(
      const Duration(seconds: 45),
      onTimeout: () {
        throw Exception(
          'Bundled Pandoc is taking too long to start. Reopen Convert Document and try again.',
        );
      },
    );
  }

  Future<PandocBridgeResult> convertDocument({
    required Uint8List inputBytes,
    required String inputFileName,
    required String inputExtension,
    required String outputExtension,
    required String outputFileName,
    Map<String, dynamic> extraOptions = const <String, dynamic>{},
    void Function(double progress, String stage)? onProgress,
  }) async {
    await ensureReady();

    final controller = _webViewController;
    if (controller == null) {
      throw Exception('Pandoc bridge is not attached yet.');
    }

    final requestId = DateTime.now().microsecondsSinceEpoch.toString();
    final pending = _PendingPandocRequest(
      completer: Completer<PandocBridgeResult>(),
      onProgress: onProgress,
    );
    _pendingRequests[requestId] = pending;

    try {
      onProgress?.call(0.12, 'Preparing document...');
      
      // Log file size for debugging
      final fileSizeMB = inputBytes.length / (1024 * 1024);
      debugPrint('PandocBridge: Converting ${inputFileName} (${fileSizeMB.toStringAsFixed(2)} MB)');
      
      final base64Input = base64Encode(inputBytes);
      final chunkCount = base64Input.isEmpty
          ? 0
          : ((base64Input.length + _inputChunkSize - 1) ~/ _inputChunkSize);

      debugPrint('PandocBridge: Splitting into $chunkCount chunks');

      await controller.runJavaScript(
        'window.formaticaResetInput(${jsonEncode(requestId)});',
      );

      for (var index = 0; index < chunkCount; index++) {
        final start = index * _inputChunkSize;
        final end = (start + _inputChunkSize).clamp(0, base64Input.length);
        final chunk = base64Input.substring(start, end);
        await controller.runJavaScript(
          'window.formaticaReceiveChunk(${jsonEncode(requestId)}, ${jsonEncode(chunk)});',
        );
        onProgress?.call(
          0.12 + ((index + 1) / chunkCount) * 0.20,
          'Loading document...',
        );
      }

      final payload = {
        'requestId': requestId,
        'inputFileName': inputFileName,
        'inputExtension': inputExtension,
        'outputExtension': outputExtension,
        'outputFileName': outputFileName,
        'extraOptions': extraOptions,
      };

      debugPrint('PandocBridge: Starting conversion');
      onProgress?.call(0.35, 'Converting document...');

      await controller.runJavaScript(
        'window.formaticaFinalizeRequest(${jsonEncode(payload)});',
      );

      // Increased timeout to 6 minutes for larger documents
      return await pending.completer.future.timeout(
        const Duration(minutes: 6),
        onTimeout: () {
          _pendingRequests.remove(requestId);
          throw Exception(
            'Document conversion timed out (6 min limit). The file may be too large or complex. Try a smaller document.',
          );
        },
      );
    } catch (error) {
      debugPrint('PandocBridge: Conversion error: $error');
      _pendingRequests.remove(requestId);
      rethrow;
    }
  }

  void handleJavaScriptMessage(String rawMessage) {
    try {
      final decoded = jsonDecode(rawMessage);
      if (decoded is! Map) {
        return;
      }

      final message = Map<String, dynamic>.from(decoded);
      final type = message['type'] as String?;
      final requestId = message['requestId'] as String?;

      switch (type) {
        case 'status':
          _statusMessage = (message['message'] as String?) ?? _statusMessage;
          notifyListeners();
          return;
        case 'ready':
          _version = message['version'] as String?;
          _statusMessage = _version == null
              ? 'Bundled Pandoc is ready.'
              : 'Pandoc $_version is ready on-device.';
          _isReady = true;
          if (!_readyCompleter.isCompleted) {
            _readyCompleter.complete();
          }
          notifyListeners();
          return;
        case 'fatal':
          final errorMessage = (message['message'] as String?) ??
              'Bundled Pandoc could not be started.';
          reportFatalError(errorMessage);
          return;
        case 'log':
          final level = message['level'] as String?;
          final msg = message['message'] as String?;
          debugPrint('PandocBridgeJS ($level): $msg');
          if (level == 'error' && !_isReady) {
            _statusMessage = 'Engine error: $msg';
            notifyListeners();
          }
          return;
        default:
          break;
      }

      if (requestId == null) {
        return;
      }

      final pending = _pendingRequests[requestId];
      if (pending == null) {
        return;
      }

      switch (type) {
        case 'progress':
          final progress = _readDouble(message['progress']) ?? 0.0;
          final stage = (message['stage'] as String?) ?? 'Converting...';
          pending.onProgress?.call(0.32 + (progress * 0.56), stage);
          return;
        case 'result_start':
          final totalChunks = _readInt(message['totalChunks']) ?? 0;
          pending.fileName = (message['fileName'] as String?) ?? 'output.bin';
          pending.mimeType =
              (message['mimeType'] as String?) ?? 'application/octet-stream';
          pending.stderr = message['stderr'] as String?;
          pending.warnings = _readWarnings(message['warnings']);
          pending.totalChunks = totalChunks;
          pending.resultChunks = List.filled(totalChunks, '');
          pending.receivedChunks = 0;
          pending.onProgress?.call(0.90, 'Saving output...');
          return;
        case 'result_chunk':
          final index = _readInt(message['index']) ?? -1;
          final chunk = (message['chunk'] as String?) ?? '';
          final resultChunks = pending.resultChunks;
          if (resultChunks == null ||
              index < 0 ||
              index >= resultChunks.length) {
            return;
          }
          resultChunks[index] = chunk;
          pending.receivedChunks += 1;
          final progress = pending.totalChunks <= 0
              ? 1.0
              : pending.receivedChunks / pending.totalChunks;
          pending.onProgress
              ?.call(0.90 + (progress * 0.08), 'Saving output...');
          return;
        case 'result_complete':
          final resultChunks = pending.resultChunks ?? const <String>[];
          final bytes = base64Decode(resultChunks.join());
          _pendingRequests.remove(requestId);
          if (!pending.completer.isCompleted) {
            pending.completer.complete(
              PandocBridgeResult(
                bytes: Uint8List.fromList(bytes),
                fileName: pending.fileName ?? 'output.bin',
                mimeType: pending.mimeType ?? 'application/octet-stream',
                stderr: pending.stderr,
                warnings: pending.warnings,
              ),
            );
          }
          return;
        case 'error':
          _pendingRequests.remove(requestId);
          final errorMessage = (message['message'] as String?) ??
              'Document conversion failed inside bundled Pandoc.';
          if (!pending.completer.isCompleted) {
            pending.completer.completeError(Exception(errorMessage));
          }
          return;
        default:
          return;
      }
    } catch (error) {
      debugPrint('PandocBridgeController: invalid JS message: $error');
    }
  }

  @override
  void dispose() {
    for (final pending in _pendingRequests.values) {
      if (!pending.completer.isCompleted) {
        pending.completer.completeError(
          Exception('Document conversion was cancelled.'),
        );
      }
    }
    _pendingRequests.clear();
    super.dispose();
  }

  static double? _readDouble(Object? value) {
    if (value is num) {
      return value.toDouble();
    }
    return double.tryParse(value?.toString() ?? '');
  }

  static int? _readInt(Object? value) {
    if (value is num) {
      return value.toInt();
    }
    return int.tryParse(value?.toString() ?? '');
  }

  static List<String> _readWarnings(Object? value) {
    if (value is! List) {
      return const <String>[];
    }
    return value.map((warning) => warning.toString()).toList(growable: false);
  }
}

class PandocBridgeResult {
  const PandocBridgeResult({
    required this.bytes,
    required this.fileName,
    required this.mimeType,
    required this.stderr,
    required this.warnings,
  });

  final Uint8List bytes;
  final String fileName;
  final String mimeType;
  final String? stderr;
  final List<String> warnings;
}

class _PendingPandocRequest {
  _PendingPandocRequest({
    required this.completer,
    required this.onProgress,
  });

  final Completer<PandocBridgeResult> completer;
  final void Function(double progress, String stage)? onProgress;

  String? fileName;
  String? mimeType;
  String? stderr;
  List<String> warnings = const <String>[];
  int totalChunks = 0;
  int receivedChunks = 0;
  List<String>? resultChunks;
}
