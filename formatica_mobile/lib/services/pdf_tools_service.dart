import 'dart:io';
import 'dart:ui';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:syncfusion_flutter_pdf/pdf.dart';
import 'package:image/image.dart' as img;
import 'package:pdf/pdf.dart' as dart_pdf;
import 'package:pdf/widgets.dart' as pw;
import 'file_service.dart';
import 'package:printing/printing.dart';

class PdfToolsService {
  /// Merge multiple PDFs — fully on-device via Syncfusion
  static Future<String> mergePdfs({
    required List<String> filePaths,
    required void Function(double) onProgress,
  }) async {
    if (filePaths.length < 2) throw Exception('Need at least 2 PDFs to merge');
    onProgress(0.10);

    // Create a new document
    final mergedDoc = PdfDocument();

    for (int i = 0; i < filePaths.length; i++) {
      final bytes = await File(filePaths[i]).readAsBytes();
      final srcDoc = PdfDocument(inputBytes: bytes);

      // Import all pages from source document
      for (int j = 0; j < srcDoc.pages.count; j++) {
        final template = srcDoc.pages[j].createTemplate();
        final page = mergedDoc.pages.add();
        page.graphics.drawPdfTemplate(template, Offset.zero);
      }

      srcDoc.dispose();
      onProgress(0.10 + (i / filePaths.length) * 0.70);
    }

    // Save merged PDF
    final outDir =
        await FileService.getOutputDirectoryForCategory(OutputCategory.pdfs);
    final ts = DateTime.now().millisecondsSinceEpoch;
    final outPath = '$outDir/merged_$ts.pdf';
    final outBytes = Uint8List.fromList(await mergedDoc.save());
    mergedDoc.dispose();

    await File(outPath).writeAsBytes(outBytes);
    await FileService.scanMediaFile(outPath);
    onProgress(1.0);
    return outPath;
  }

  /// Split PDF — extract page range — fully on-device via Syncfusion
  static Future<String> splitPdf({
    required String inputFilePath,
    required int startPage,
    required int endPage,
    required void Function(double) onProgress,
  }) async {
    onProgress(0.10);

    final bytes = await File(inputFilePath).readAsBytes();
    final srcDoc = PdfDocument(inputBytes: bytes);

    // Create new document with only the selected pages
    final newDoc = PdfDocument();
    final totalPages = endPage - startPage + 1;

    for (int i = startPage - 1; i < endPage && i < srcDoc.pages.count; i++) {
      final template = srcDoc.pages[i].createTemplate();
      final srcPage = srcDoc.pages[i];
      final page = newDoc.pages.add();
      // Match source page size
      page.graphics.drawPdfTemplate(
        template,
        Offset.zero,
        Size(srcPage.getClientSize().width, srcPage.getClientSize().height),
      );
      onProgress(0.10 + ((i - startPage + 1) / totalPages) * 0.70);
    }

    srcDoc.dispose();

    // Save split PDF
    final outDir =
        await FileService.getOutputDirectoryForCategory(OutputCategory.pdfs);
    final ts = DateTime.now().millisecondsSinceEpoch;
    final outPath = '$outDir/split_pages_${startPage}_to_${endPage}_$ts.pdf';
    final outBytes = Uint8List.fromList(await newDoc.save());
    newDoc.dispose();

    await File(outPath).writeAsBytes(outBytes);
    await FileService.scanMediaFile(outPath);
    onProgress(1.0);
    return outPath;
  }

  /// Greyscale PDF — convert all colors to black & white — on-device
  /// Uses Printing to rasterize pages to high-res images, then applies dart:image grayscale filter
  static Future<String> greyScalePdf({
    required String inputFilePath,
    required void Function(double) onProgress,
  }) async {
    onProgress(0.05);

    final bytes = await File(inputFilePath).readAsBytes();
    final sourceDoc = PdfDocument(inputBytes: bytes);
    final totalPages = sourceDoc.pages.count;
    sourceDoc.dispose();
    onProgress(0.10);

    // Rebuild PDF using pdf package
    final greyDoc = pw.Document();

    // Use Printing to convert PDF pages into high-res images
    // scale: 2.0 or 3.0 gives high DPI. 2.0 is usually sufficient (144 DPI)
    int pageNum = 0;

    try {
      await for (final pageImage in Printing.raster(bytes, dpi: 300)) {
        final pngBytes = await pageImage.toPng();
        final rawImage = img.decodePng(pngBytes);
        if (rawImage == null) {
          throw Exception('Failed to decode rasterized page ${pageNum + 1}.');
        }

        // Apply grayscale filter
        final grayscaled = img.grayscale(rawImage);

        // Convert back to jpeg for small PDF embedding
        final jpegBytes = img.encodeJpg(grayscaled, quality: 95);

        // Render onto PDF page
        final pdfImage = pw.MemoryImage(jpegBytes);

        greyDoc.addPage(
          pw.Page(
            pageFormat: dart_pdf.PdfPageFormat(
              pageImage.width.toDouble() * 72.0 / 300.0,
              pageImage.height.toDouble() * 72.0 / 300.0,
            ),
            build: (pw.Context context) {
              return pw.FullPage(
                ignoreMargins: true,
                child: pw.Image(pdfImage, fit: pw.BoxFit.contain),
              );
            },
          ),
        );
        pageNum++;
        final progressBase = totalPages <= 0 ? 0.85 : pageNum / totalPages;
        onProgress(0.15 + (progressBase * 0.75));
      }
    } catch (e) {
      debugPrint('Greyscale error: $e');
      throw Exception('Failed to rasterize PDF for greyscale: $e');
    }

    onProgress(0.95);

    // Save greyscale PDF
    final outDir =
        await FileService.getOutputDirectoryForCategory(OutputCategory.pdfs);
    final base = p.basenameWithoutExtension(inputFilePath);
    final ts = DateTime.now().millisecondsSinceEpoch;
    final outPath = '$outDir/${base}_greyscale_$ts.pdf';

    final outBytes = await greyDoc.save();

    await File(outPath).writeAsBytes(outBytes);
    await FileService.scanMediaFile(outPath);
    onProgress(1.0);

    return outPath;
  }
}
