import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:path/path.dart' as p;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../core/constants.dart';
import 'file_service.dart';
import 'pandoc_bridge.dart';

class ConvertService {
  static Future<String> convertDocument({
    required PandocBridgeController bridge,
    required String inputFilePath,
    required String outputFormat,
    required void Function(double) onProgress,
    void Function(String stage)? onStage,
  }) async {
    onProgress(0.02);
    final inputFile = File(inputFilePath);
    if (!await inputFile.exists()) {
      throw Exception('Selected document could not be found.');
    }

    final inputExtension =
        p.extension(inputFilePath).replaceFirst('.', '').toLowerCase();
    if (!AppConstants.documentInputFormats.contains(inputExtension)) {
      throw Exception('Unsupported document format: .$inputExtension');
    }

    final normalizedOutputFormat = _normalizeOutputFormat(outputFormat);
    final supportedOutputs =
        AppConstants.documentOutputFormats[inputExtension] ??
            AppConstants
                .documentOutputFormats[_fallbackInputFormat(inputExtension)] ??
            const <String>[];
    if (!supportedOutputs.contains(normalizedOutputFormat)) {
      throw Exception(
          'Pandoc cannot convert .$inputExtension to .$normalizedOutputFormat on-device.');
    }

    final base = p.basenameWithoutExtension(inputFilePath);
    final outputCategory = normalizedOutputFormat == 'pdf'
        ? OutputCategory.pdfs
        : OutputCategory.documents;
    final outDir =
        await FileService.getOutputDirectoryForCategory(outputCategory);
    final ts = DateTime.now().millisecondsSinceEpoch;
    final outPath = '$outDir/${base}_converted_$ts.$normalizedOutputFormat';
    final inputBytes = await inputFile.readAsBytes();
    if (inputBytes.isEmpty) {
      throw Exception('The selected document is empty.');
    }

    late final Uint8List outputBytes;
    if (normalizedOutputFormat == 'pdf') {
      outputBytes = await _convertDocumentToPdf(
        bridge: bridge,
        inputBytes: inputBytes,
        inputFilePath: inputFilePath,
        inputExtension: inputExtension,
        outputFileName: p.basename(outPath),
        onProgress: onProgress,
        onStage: onStage,
      );
    } else {
      final result = await _runPandocConversion(
        bridge: bridge,
        inputBytes: inputBytes,
        inputFilePath: inputFilePath,
        inputExtension: inputExtension,
        outputExtension: normalizedOutputFormat,
        outputFileName: p.basename(outPath),
        startProgress: 0.08,
        endProgress: 0.98,
        onProgress: onProgress,
        onStage: onStage,
      );
      outputBytes = result.bytes;
    }

    onProgress(0.98);
    final file = File(outPath);
    await file.writeAsBytes(outputBytes, flush: true);

    await FileService.scanMediaFile(outPath);
    onProgress(1.0);

    return outPath;
  }

  static String _normalizeOutputFormat(String format) {
    switch (format.toLowerCase()) {
      case 'markdown':
        return 'md';
      case 'html':
      case 'txt':
      case 'rtf':
      case 'docx':
      case 'odt':
      case 'epub':
      case 'md':
      case 'pdf':
        return format.toLowerCase();
      default:
        throw Exception('Unsupported document output format: .$format');
    }
  }

  static String _fallbackInputFormat(String format) {
    if (format == 'htm') {
      return 'html';
    }
    return format;
  }

  static Future<Uint8List> _convertDocumentToPdf({
    required PandocBridgeController bridge,
    required Uint8List inputBytes,
    required String inputFilePath,
    required String inputExtension,
    required String outputFileName,
    required void Function(double) onProgress,
    void Function(String stage)? onStage,
  }) async {
    final normalizedInput = _fallbackInputFormat(inputExtension);
    late final String html;

    if (normalizedInput == 'html') {
      onStage?.call('Preparing HTML for PDF...');
      onProgress(0.30);
      html = _ensureHtmlDocument(
        utf8.decode(inputBytes, allowMalformed: true),
      );
    } else {
      final htmlResult = await _runPandocConversion(
        bridge: bridge,
        inputBytes: inputBytes,
        inputFilePath: inputFilePath,
        inputExtension: inputExtension,
        outputExtension: 'html',
        outputFileName: '${p.basenameWithoutExtension(outputFileName)}.html',
        startProgress: 0.08,
        endProgress: 0.72,
        onProgress: onProgress,
        onStage: onStage,
        extraOptions: const {'embed-resources': true},
      );
      html = _ensureHtmlDocument(
        utf8.decode(htmlResult.bytes, allowMalformed: true),
      );
    }

    return _renderPdfFromHtml(
      html: html,
      inputFilePath: inputFilePath,
      onProgress: onProgress,
      onStage: onStage,
    );
  }

  static Future<PandocBridgeResult> _runPandocConversion({
    required PandocBridgeController bridge,
    required Uint8List inputBytes,
    required String inputFilePath,
    required String inputExtension,
    required String outputExtension,
    required String outputFileName,
    required double startProgress,
    required double endProgress,
    required void Function(double) onProgress,
    void Function(String stage)? onStage,
    Map<String, dynamic> extraOptions = const <String, dynamic>{},
  }) async {
    return bridge.convertDocument(
      inputBytes: Uint8List.fromList(inputBytes),
      inputFileName: p.basename(inputFilePath),
      inputExtension: inputExtension,
      outputExtension: outputExtension,
      outputFileName: outputFileName,
      extraOptions: extraOptions,
      onProgress: (progress, stage) {
        onStage?.call(stage);
        onProgress(startProgress + ((endProgress - startProgress) * progress));
      },
    );
  }

  static Future<Uint8List> _renderPdfFromHtml({
    required String html,
    required String inputFilePath,
    required void Function(double) onProgress,
    void Function(String stage)? onStage,
  }) async {
    onStage?.call('Rendering PDF...');
    onProgress(0.82);

    try {
      // ignore: deprecated_member_use
      final pdfBytes = await Printing.convertHtml(
        html: html,
        baseUrl: Uri.directory(p.dirname(inputFilePath)).toString(),
        format: PdfPageFormat.a4,
      );
      onProgress(0.96);
      return pdfBytes;
    } catch (_) {
      onStage?.call('Falling back to text-safe PDF rendering...');
      final fallbackBytes = await _renderTextOnlyPdf(html);
      onProgress(0.96);
      return fallbackBytes;
    }
  }

  static Future<Uint8List> _renderTextOnlyPdf(String html) async {
    final document = pw.Document();
    final plainText = _htmlToPlainText(html);
    final paragraphs = plainText
        .split(RegExp(r'\n\s*\n'))
        .map((paragraph) => paragraph.trim())
        .where((paragraph) => paragraph.isNotEmpty)
        .toList(growable: false);

    document.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        build: (context) {
          if (paragraphs.isEmpty) {
            return [pw.Text(' ')];
          }

          return paragraphs
              .map(
                (paragraph) => pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 10),
                  child: pw.Text(paragraph),
                ),
              )
              .toList(growable: false);
        },
      ),
    );

    return Uint8List.fromList(await document.save());
  }

  static String _ensureHtmlDocument(String html) {
    final trimmed = html.trim();
    if (trimmed.contains(RegExp(r'<html[\s>]', caseSensitive: false))) {
      return trimmed;
    }

    return '''
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: sans-serif; line-height: 1.45; padding: 24px; color: #111827; }
      img { max-width: 100%; height: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
      pre { white-space: pre-wrap; word-break: break-word; }
    </style>
  </head>
  <body>
    $trimmed
  </body>
</html>
''';
  }

  static String _htmlToPlainText(String html) {
    var text = html
        .replaceAll(
          RegExp(r'<(script|style)[^>]*>[\s\S]*?</\1>', caseSensitive: false),
          ' ',
        )
        .replaceAll(
          RegExp(
            r'</(p|div|section|article|header|footer|li|tr|h[1-6]|pre|blockquote)>',
            caseSensitive: false,
          ),
          '\n',
        )
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'</t[dh]>', caseSensitive: false), '\t')
        .replaceAll(RegExp(r'<[^>]+>'), ' ');

    text = _decodeHtmlEntities(text);
    text = text
        .replaceAll(RegExp(r'[ \t]+\n'), '\n')
        .replaceAll(RegExp(r'\n{3,}'), '\n\n')
        .replaceAll(RegExp(r'[ \t]{2,}'), ' ')
        .trim();

    return text;
  }

  static String _decodeHtmlEntities(String text) {
    const namedEntities = <String, String>{
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
    };

    var decoded = text;
    namedEntities.forEach((entity, replacement) {
      decoded = decoded.replaceAll(entity, replacement);
    });

    return decoded.replaceAllMapped(
      RegExp(r'&#(x?)([0-9a-fA-F]+);'),
      (match) {
        final isHex = match.group(1)?.toLowerCase() == 'x';
        final rawValue = match.group(2);
        if (rawValue == null) {
          return match.group(0) ?? '';
        }

        final codePoint = int.tryParse(rawValue, radix: isHex ? 16 : 10);
        if (codePoint == null) {
          return match.group(0) ?? '';
        }

        return String.fromCharCode(codePoint);
      },
    );
  }
}
