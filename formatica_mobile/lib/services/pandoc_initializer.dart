import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

class PandocInitializer {
  static final PandocInitializer _instance = PandocInitializer._internal();
  factory PandocInitializer() => _instance;
  PandocInitializer._internal();

  bool _isInitialized = false;
  String? _localBridgePath;

  static const List<String> _rootFiles = [
    'bridge.html',
    'bridge.js',
    'pandoc.js',
    'pandoc.wasm',
  ];

  static const List<String> _wasiFiles = [
    'debug.js',
    'fd.js',
    'fs_mem.js',
    'fs_opfs.js',
    'index.js',
    'strace.js',
    'wasi.js',
    'wasi_defs.js',
  ];

  Future<String> ensureInitialized() async {
    if (_isInitialized && _localBridgePath != null) {
      return _localBridgePath!;
    }

    debugPrint('PandocInitializer: Starting initialization...');

    final supportDir = await getApplicationSupportDirectory();
    debugPrint('PandocInitializer: supportDir = ${supportDir.path}');
    
    final pandocDir = Directory(p.join(supportDir.path, 'pandoc'));
    final wasiDir = Directory(p.join(pandocDir.path, 'wasi'));

    if (!await pandocDir.exists()) {
      await pandocDir.create(recursive: true);
      debugPrint('PandocInitializer: Created pandocDir: ${pandocDir.path}');
    }
    if (!await wasiDir.exists()) {
      await wasiDir.create(recursive: true);
      debugPrint('PandocInitializer: Created wasiDir: ${wasiDir.path}');
    }

    // Copy root files
    debugPrint('PandocInitializer: Copying root files...');
    for (final file in _rootFiles) {
      try {
        final target = File(p.join(pandocDir.path, file));
        final data = await rootBundle.load('assets/pandoc/$file');
        final bytes = data.buffer.asUint8List();
        await target.writeAsBytes(bytes, flush: true);
        debugPrint('PandocInitializer: Copied $file (${bytes.length} bytes)');
      } catch (e) {
        debugPrint('PandocInitializer: ERROR copying $file: $e');
        rethrow;
      }
    }

    // Copy wasi files
    debugPrint('PandocInitializer: Copying WASI files...');
    for (final file in _wasiFiles) {
      try {
        final target = File(p.join(wasiDir.path, file));
        final data = await rootBundle.load('assets/pandoc/wasi/$file');
        final bytes = data.buffer.asUint8List();
        await target.writeAsBytes(bytes, flush: true);
        debugPrint('PandocInitializer: Copied wasi/$file (${bytes.length} bytes)');
      } catch (e) {
        debugPrint('PandocInitializer: ERROR copying wasi/$file: $e');
        rethrow;
      }
    }

    _localBridgePath = p.join(pandocDir.path, 'bridge.html');
    _isInitialized = true;
    debugPrint('PandocInitializer: Initialization complete. bridgePath = $_localBridgePath');
    return _localBridgePath!;
  }
}
