import 'package:flutter/material.dart';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/pdf_tools_service.dart';
import '../services/file_service.dart';
import '../providers/task_provider.dart';
import '../widgets/success_card.dart';

class SplitPdfScreen extends StatefulWidget {
  const SplitPdfScreen({super.key});

  @override
  State<SplitPdfScreen> createState() => _SplitPdfScreenState();
}

class _SplitPdfScreenState extends State<SplitPdfScreen> {
  String? _filePath;
  String? _fileName;
  int? _fileSizeBytes;
  
  final _startPageController = TextEditingController(text: '1');
  final _endPageController = TextEditingController(text: '0');

  bool _isConverting = false;
  double _progress = 0.0;
  String? _errorMessage;
  String? _outputPath;

  @override
  void dispose() {
    _startPageController.dispose();
    _endPageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Split PDF'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _privacyBadge(context),
              const SizedBox(height: 20),
              _fileDropZone(context),
              if (_filePath != null) ...[
                const SizedBox(height: 24),
                const Text('PAGE RANGE', style: AppTextStyles.sectionLabel),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildPageInput('Start Page', _startPageController),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _buildPageInput('End Page', _endPageController),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text('Enter 0 for end page to split to last page', style: AppTextStyles.caption),
              ],
              if (_isConverting) _progressSection(),
              if (_errorMessage != null) _buildErrorCard(),
              if (_outputPath != null && !_isConverting) _buildSuccessCard(),
              if (_filePath != null && !_isConverting) _buildOutputLocation(context),
              const SizedBox(height: 32),
              _splitButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPageInput(String label, TextEditingController controller) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  Widget _buildOutputLocation(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return FutureBuilder<Directory>(
      future: getApplicationDocumentsDirectory(),
      builder: (ctx, snap) {
        if (!snap.hasData) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            Text('SAVE TO',
                style: AppTextStyles.sectionLabel.copyWith(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkCard : AppColors.lightCard,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
              ),
              child: Row(
                children: [
                  const Icon(Icons.folder_outlined, size: 18, color: AppColors.primaryIndigo),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      snap.data!.path,
                      style: AppTextStyles.fieldLabel,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text('Default',
                      style: AppTextStyles.caption.copyWith(
                          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary)),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _privacyBadge(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.successTeal.withAlpha(25),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Row(
        children: [
          Icon(Icons.offline_bolt, size: 14, color: AppColors.successTeal),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              '⚡ Processed entirely on-device — no internet required',
              style: AppTextStyles.caption,
            ),
          ),
        ],
      ),
    );
  }

  Widget _fileDropZone(BuildContext context) {
    return GestureDetector(
      onTap: _isConverting ? null : _pickFile,
      child: Container(
        height: 120,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.withAlpha(100), width: 1.5, style: BorderStyle.solid),
        ),
        child: _filePath == null
            ? const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.picture_as_pdf_outlined, size: 32, color: Colors.grey),
                  SizedBox(height: 8),
                  Text('Tap to select PDF', style: AppTextStyles.bodyText),
                ],
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.check_circle, color: AppColors.successTeal, size: 20),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          _fileName!,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.bodyText.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        FileService.formatFileSize(_fileSizeBytes!),
                        style: AppTextStyles.caption.copyWith(color: Colors.grey),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text('Tap to change file', style: AppTextStyles.caption),
                ],
              ),
      ),
    );
  }

  Widget _progressSection() {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Splitting... ${(_progress * 100).toInt()}%', style: AppTextStyles.bodyText),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: _progress,
              minHeight: 6,
              backgroundColor: Colors.grey.withAlpha(40),
              valueColor: const AlwaysStoppedAnimation(AppColors.primaryIndigo),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Container(
        padding: const EdgeInsets.all(12),
        width: double.infinity,
        decoration: BoxDecoration(color: Colors.red.withAlpha(20), borderRadius: BorderRadius.circular(8)),
        child: Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 13)),
      ),
    );
  }

  Widget _buildSuccessCard() {
    return SuccessCard(
      outputPath: _outputPath!,
      label: 'PDF split successfully',
      onConvertAnother: _resetForm,
    );
  }

  Widget _splitButton() {
    final canConvert = _filePath != null && !_isConverting;
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: canConvert ? _onConvert : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryIndigo,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: _isConverting
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : const Text('Split PDF', style: AppTextStyles.buttonLabel),
      ),
    );
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
    );
    if (result != null) {
      setState(() {
        _filePath = result.files.single.path;
        _fileName = result.files.single.name;
        _fileSizeBytes = result.files.single.size;
        _errorMessage = null;
        _outputPath = null;
      });
    }
  }

  Future<void> _onConvert() async {
    final st = int.tryParse(_startPageController.text);
    final ed = int.tryParse(_endPageController.text);
    if (st == null || ed == null) {
      setState(() => _errorMessage = "Please enter valid numbers");
      return;
    }

    setState(() { _isConverting = true; _errorMessage = null; });
    final provider = context.read<TaskProvider>();
    final taskId = provider.addTask('Split $_fileName', 'split');
    setState(() { _progress = 0.02; });

    try {
      final outputPath = await PdfToolsService.splitPdf(
        inputFilePath: _filePath!,
        startPage: st,
        endPage: ed,
        onProgress: (p) {
          if (mounted) {
            setState(() => _progress = p);
            provider.updateProgress(taskId, p);
          }
        },
      );
      provider.completeTask(taskId, outputPath);
      setState(() { _outputPath = outputPath; _isConverting = false; });
    } catch (e) {
      provider.failTask(taskId, e.toString());
      setState(() { _errorMessage = e.toString(); _isConverting = false; });
    }
  }

  void _resetForm() {
    setState(() {
      _filePath = null;
      _fileName = null;
      _outputPath = null;
      _startPageController.text = '1';
      _endPageController.text = '0';
    });
  }
}
