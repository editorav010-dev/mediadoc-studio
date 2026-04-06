import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;

/// Output category determines which subfolder files go to
enum OutputCategory {
  documents, // Convert Document
  pdfs,      // Images to PDF, Merge, Split, Greyscale
  audio,     // Extract Audio
  videos,    // Convert Video, Compress Video
  images,    // Convert Image
}

class FileService {
  static const _platform = MethodChannel('com.formatica/platform');
  static const _appFolderName = 'Formatica';
  
  static Future<Directory> getBaseDirectory() async {
    if (Platform.isAndroid) {
      final downloadDirs = await getExternalStorageDirectories(
        type: StorageDirectory.downloads,
      );
      Directory? parentDir;
      if (downloadDirs != null && downloadDirs.isNotEmpty) {
        parentDir = downloadDirs.first;
      }

      parentDir ??= await getExternalStorageDirectory();
      parentDir ??= await getApplicationDocumentsDirectory();

      final dir = Directory(path.join(parentDir.path, _appFolderName));
      if (!await dir.exists()) {
        await dir.create(recursive: true);
      }
      return dir;
    } else {
      final dir = await getApplicationDocumentsDirectory();
      final formaticaDir = Directory(path.join(dir.path, _appFolderName));
      if (!await formaticaDir.exists()) {
        await formaticaDir.create(recursive: true);
      }
      return formaticaDir;
    }
  }

  static Future<String> _getBaseDir() async => (await getBaseDirectory()).path;

  /// Get the subfolder name for a category
  static String _subfolderName(OutputCategory category) {
    switch (category) {
      case OutputCategory.documents: return 'Documents';
      case OutputCategory.pdfs:     return 'PDFs';
      case OutputCategory.audio:    return 'Audio';
      case OutputCategory.videos:   return 'Videos';
      case OutputCategory.images:   return 'Images';
    }
  }

  /// Get directory path for a specific category
  static Future<String> getOutputDirectoryForCategory(OutputCategory category) async {
    final base = await _getBaseDir();
    final subfolder = _subfolderName(category);
    final dir = Directory(path.join(base, subfolder));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir.path;
  }

  /// Map feature type string to output category
  static OutputCategory categoryFromFeatureType(String featureType) {
    switch (featureType) {
      case 'convert':      return OutputCategory.documents;
      case 'imagesToPdf':  return OutputCategory.pdfs;
      case 'extractAudio': return OutputCategory.audio;
      case 'convertVideo': return OutputCategory.videos;
      case 'compressVideo':return OutputCategory.videos;
      case 'convertImage': return OutputCategory.images;
      case 'mergePdf':     return OutputCategory.pdfs;
      case 'splitPdf':     return OutputCategory.pdfs;
      case 'greyscalePdf': return OutputCategory.pdfs;
      default:             return OutputCategory.documents;
    }
  }

  /// Save bytes to the correct category subfolder and scan for gallery
  static Future<String> saveToCategory(
    Uint8List bytes,
    String filename,
    OutputCategory category,
  ) async {
    final dir = await getOutputDirectoryForCategory(category);
    final outPath = '$dir/$filename';
    await File(outPath).writeAsBytes(bytes);
    
    // Notify Android MediaStore so file appears in gallery/file manager
    await scanMediaFile(outPath);
    
    return outPath;
  }

  /// Legacy method — routes to documents category
  static Future<String> saveToDownloads(Uint8List bytes, String filename) async {
    return saveToCategory(bytes, filename, OutputCategory.documents);
  }

  /// Save raw bytes to output directory (for on-device operations like Images to PDF)
  static Future<String> saveOutput(Uint8List bytes, String filename) async {
    return saveToCategory(bytes, filename, OutputCategory.pdfs);
  }

  /// Notify Android MediaStore about a new file
  static Future<void> scanMediaFile(String filePath) async {
    try {
      if (Platform.isAndroid) {
        await _platform.invokeMethod('scanMediaFile', {'path': filePath});
        debugPrint('FileService: Scanned $filePath for gallery');
      }
    } catch (e) {
      debugPrint('FileService: MediaScanner error: $e');
    }
  }

  /// Opens the file with the system default app
  static Future<void> openFile(String filePath) async {
    final result = await OpenFilex.open(filePath);
    debugPrint('OpenFilex result: ${result.type} — ${result.message}');
  }

  /// Opens the containing folder in Android's file manager
  static Future<void> showInFolder(String filePath) async {
    if (Platform.isAndroid) {
      final folderPath = await FileSystemEntity.isDirectory(filePath)
          ? filePath
          : path.dirname(filePath);
      try {
        await _platform.invokeMethod('openFolder', {'path': folderPath});
      } catch (e) {
        debugPrint('FileService: openFolder error: $e, falling back to OpenFilex');
        // Fallback: try opening the file itself
        await openFile(filePath);
      }
    } else {
      await openFile(filePath);
    }
  }

  static String getFileName(String filePath) => path.basename(filePath);

  static String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  /// Get the display-friendly output path for UI
  static String getDisplayPath(String fullPath) {
    final idx = fullPath.indexOf(_appFolderName);
    if (idx != -1) return fullPath.substring(idx);
    return path.basename(fullPath);
  }

  /// Get total storage used by all Formatica output folders
  static Future<int> getTotalStorageUsed() async {
    try {
      final base = await _getBaseDir();
      final dir = Directory(base);
      if (!await dir.exists()) return 0;
      int total = 0;
      await for (final entity in dir.list(recursive: true)) {
        if (entity is File) {
          total += await entity.length();
        }
      }
      return total;
    } catch (e) {
      return 0;
    }
  }
}
