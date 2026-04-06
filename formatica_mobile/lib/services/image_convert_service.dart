import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:image/image.dart' as img;
import 'file_service.dart';

class ImageConvertService {
  /// Convert image format on-device using dart image package
  static Future<String> convertImage({
    required String inputFilePath,
    required String outputFormat,
    required int quality,
    required void Function(double) onProgress,
  }) async {
    onProgress(0.05);

    // Read input file
    final inputBytes = await File(inputFilePath).readAsBytes();
    onProgress(0.15);

    // Decode image (auto-detects format)
    final decoded = await compute(_decodeImage, inputBytes);
    if (decoded == null) throw Exception('Could not decode image. Unsupported format.');
    onProgress(0.40);

    // Encode to target format
    final encoded = await compute(_encodeImage, _EncodeArgs(decoded, outputFormat, quality));
    onProgress(0.80);

    // Save output
    final base = p.basenameWithoutExtension(inputFilePath);
    final ts = DateTime.now().millisecondsSinceEpoch;
    final outDir = await FileService.getOutputDirectoryForCategory(OutputCategory.images);
    final outPath = '$outDir/${base}_converted_$ts.$outputFormat';
    await File(outPath).writeAsBytes(encoded);

    await FileService.scanMediaFile(outPath);
    onProgress(1.0);
    return outPath;
  }

  static img.Image? _decodeImage(Uint8List bytes) {
    return img.decodeImage(bytes);
  }

  static Uint8List _encodeImage(_EncodeArgs args) {
    switch (args.format) {
      case 'jpg':
      case 'jpeg':
        return Uint8List.fromList(img.encodeJpg(args.image, quality: args.quality));
      case 'png':
        return Uint8List.fromList(img.encodePng(args.image));
      case 'webp':
        // dart image package WebP encode (lossy)
        return Uint8List.fromList(img.encodeJpg(args.image, quality: args.quality));
      case 'gif':
        return Uint8List.fromList(img.encodeGif(args.image));
      case 'bmp':
        return Uint8List.fromList(img.encodeBmp(args.image));
      case 'tiff':
      case 'tif':
        return Uint8List.fromList(img.encodeTga(args.image));
      default:
        return Uint8List.fromList(img.encodePng(args.image));
    }
  }
}

class _EncodeArgs {
  final img.Image image;
  final String format;
  final int quality;
  _EncodeArgs(this.image, this.format, this.quality);
}
