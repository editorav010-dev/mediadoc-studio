import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:pdf/pdf.dart';
import 'dart:io';
import '../core/theme.dart';
import '../services/file_service.dart';
import '../providers/task_provider.dart';
import '../widgets/success_card.dart';

class ImagesToPdfScreen extends StatefulWidget {
  const ImagesToPdfScreen({super.key});

  @override
  State<ImagesToPdfScreen> createState() => _ImagesToPdfScreenState();
}

class _ImagesToPdfScreenState extends State<ImagesToPdfScreen> {
  final List<String> _selectedImagePaths = [];
  bool _isLoading = false;
  String? _errorMessage;
  String? _outputPath;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Images to PDF')),
      body: Column(
        children: [
          _onDeviceBadge(context),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('SELECT IMAGES', style: AppTextStyles.sectionLabel),
                  const SizedBox(height: 12),
                  _imageGrid(context),
                  if (_errorMessage != null) _buildErrorCard(),
                  if (_outputPath != null && !_isLoading) _buildSuccessCard(),
                ],
              ),
            ),
          ),
          _bottomBar(context),
        ],
      ),
    );
  }

  Widget _onDeviceBadge(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: AppColors.primaryIndigo.withAlpha(20),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.bolt, size: 16, color: AppColors.primaryIndigo),
          SizedBox(width: 8),
          Text(
            'Processed on-device. No data leaves your phone.',
            style: AppTextStyles.caption,
          ),
        ],
      ),
    );
  }

  Widget _imageGrid(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        ..._selectedImagePaths.asMap().entries.map((entry) {
          final index = entry.key;
          final imgPath = entry.value;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  image: DecorationImage(image: FileImage(File(imgPath)), fit: BoxFit.cover),
                  border: Border.all(color: Colors.grey.withAlpha(50)),
                ),
              ),
              Positioned(
                top: -8,
                right: -8,
                child: GestureDetector(
                  onTap: () => setState(() => _selectedImagePaths.removeAt(index)),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                    child: const Icon(Icons.close, size: 14, color: Colors.white),
                  ),
                ),
              ),
              Positioned(
                bottom: 4,
                left: 4,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: Colors.black.withAlpha(150), borderRadius: BorderRadius.circular(4)),
                  child: Text('${index + 1}', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          );
        }),
        GestureDetector(
          onTap: _addImages,
          child: Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.withAlpha(100), width: 1.5, style: BorderStyle.solid),
            ),
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.add_photo_alternate_outlined, color: Colors.grey),
                SizedBox(height: 4),
                Text('Add', style: AppTextStyles.caption),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildErrorCard() {
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.red.withAlpha(20), borderRadius: BorderRadius.circular(8)),
        child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 13)),
      ),
    );
  }

  Widget _buildSuccessCard() {
    return SuccessCard(
      outputPath: _outputPath!,
      label: 'PDF created successfully',
      onConvertAnother: _resetForm,
    );
  }

  Widget _bottomBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        border: Border(top: BorderSide(color: Colors.grey.withAlpha(50))),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${_selectedImagePaths.length} images selected', style: AppTextStyles.caption),
                if (_selectedImagePaths.isNotEmpty)
                  GestureDetector(
                    onTap: () => setState(() => _selectedImagePaths.clear()),
                    child: const Text('Clear All', style: TextStyle(color: Colors.red, fontSize: 12)),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: (_isLoading || _selectedImagePaths.isEmpty) ? null : _onCreatePdf,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primaryIndigo,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isLoading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Create PDF', style: AppTextStyles.buttonLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _addImages() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.image, allowMultiple: true);
    if (result != null) {
      setState(() {
        for (var imgPath in result.paths) {
          if (imgPath != null && !_selectedImagePaths.contains(imgPath)) {
            _selectedImagePaths.add(imgPath);
          }
        }
        _errorMessage = null;
        _outputPath = null;
      });
    }
  }

  Future<void> _onCreatePdf() async {
    if (_selectedImagePaths.isEmpty) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _outputPath = null;
    });
    final provider = context.read<TaskProvider>();
    final taskId = provider.addTask('${_selectedImagePaths.length} images → PDF', 'imagesToPdf');
    provider.updateProgress(taskId, 0.1);

    try {
      // Read all image bytes on main thread
      final List<Uint8List> imageBytesList = [];
      for (final imgPath in _selectedImagePaths) {
        final bytes = await File(imgPath).readAsBytes();
        imageBytesList.add(bytes);
      }
      provider.updateProgress(taskId, 0.3);

      // Use compute() instead of Isolate.run() — handles serialization properly
      final pdfBytes = await compute(_buildPdf, imageBytesList);
      provider.updateProgress(taskId, 0.9);

      // Save to organized PDFs folder
      final filename = "formatica_${DateTime.now().millisecondsSinceEpoch}.pdf";
      final outPath = await FileService.saveToCategory(
        pdfBytes, filename, OutputCategory.pdfs);
      provider.completeTask(taskId, outPath);

      if (mounted) {
        setState(() {
          _outputPath = outPath;
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('PDF saved to ${FileService.getDisplayPath(outPath)}'),
            backgroundColor: AppColors.successTeal,
            action: SnackBarAction(
              label: 'Open',
              textColor: Colors.white,
              onPressed: () => FileService.openFile(outPath),
            ),
          ),
        );
      }
    } catch (e) {
      provider.failTask(taskId, e.toString());
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  void _resetForm() {
    setState(() {
      _selectedImagePaths.clear();
      _outputPath = null;
    });
  }
}

// Top-level function for compute() — must be static/top-level
Future<Uint8List> _buildPdf(List<Uint8List> imageBytesList) async {
  final doc = pw.Document();
  for (final bytes in imageBytesList) {
    final image = pw.MemoryImage(bytes);
    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: pw.EdgeInsets.zero,
      build: (ctx) => pw.Center(
        child: pw.Image(image, fit: pw.BoxFit.contain),
      ),
    ));
  }
  return await doc.save();
}
