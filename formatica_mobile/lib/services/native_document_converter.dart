import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;

import 'file_service.dart';

/// Service for native document conversion using Apache POI.
/// Handles XLSX, XLS, PPTX, PPT, and CSV to PDF conversions.
class NativeDocumentConverter {
  static const MethodChannel _channel = MethodChannel('com.formatica/platform');

  /// Convert a document to PDF using native Android libraries.
  /// 
  /// Supported formats: XLSX, XLS, PPTX, PPT, CSV
  /// 
  /// Returns the path to the generated PDF file.
  static Future<String> convertToPdf({
    required String inputPath,
    required String format,
    void Function(double progress)? onProgress,
  }) async {
    try {
      onProgress?.call(0.1);

      // Generate output path
      final baseName = p.basenameWithoutExtension(inputPath);
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final outDir = await FileService.getOutputDirectoryForCategory(OutputCategory.pdfs);
      final outputPath = '$outDir/${baseName}_converted_$timestamp.pdf';

      onProgress?.call(0.2);

      // Call native converter
      final resultPath = await _channel.invokeMethod<String>(
        'convertDocumentToPdf',
        {
          'inputPath': inputPath,
          'outputPath': outputPath,
          'format': format.toLowerCase(),
        },
      );

      if (resultPath == null || resultPath.isEmpty) {
        throw Exception('Native converter returned empty result');
      }

      onProgress?.call(0.9);

      // Verify output file exists
      final outputFile = File(resultPath);
      if (!await outputFile.exists()) {
        throw Exception('Output PDF file was not created');
      }

      // Scan file for media store
      await FileService.scanMediaFile(resultPath);

      onProgress?.call(1.0);

      return resultPath;
    } on PlatformException catch (e) {
      throw Exception('Native conversion failed: ${e.message ?? e.code}');
    } catch (e) {
      throw Exception('Document conversion failed: $e');
    }
  }

  /// Check if a format is supported by the native converter.
  static bool isSupported(String format) {
    final supportedFormats = ['xlsx', 'xls', 'pptx', 'ppt', 'csv'];
    return supportedFormats.contains(format.toLowerCase());
  }
}
