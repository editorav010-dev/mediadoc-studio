import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/constants.dart';
import '../core/theme.dart';
import '../providers/task_provider.dart';
import '../services/convert_service.dart';
import '../services/file_service.dart';
import '../services/pandoc_bridge.dart';
import '../widgets/pandoc_bridge_view.dart';
import '../widgets/success_card.dart';

class ConvertScreen extends StatefulWidget {
  const ConvertScreen({super.key});

  @override
  State<ConvertScreen> createState() => _ConvertScreenState();
}

class _ConvertScreenState extends State<ConvertScreen> {
  // Pandoc bridge controller for document conversion
  final PandocBridgeController _pandocBridge = PandocBridgeController();

  String? _filePath;
  String? _fileName;
  int? _fileSizeBytes;
  String? _selectedFormat;
  bool _isConverting = false;
  double _progress = 0.0;
  String? _errorMessage;
  String? _outputPath;
  String _progressLabel = 'Preparing document...';

  @override
  void dispose() {
    _pandocBridge.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Convert Document'),
      ),
      body: Stack(
        children: [
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _privacyBadge(context),
                  const SizedBox(height: 16),
                  _engineStatusCard(),
                  const SizedBox(height: 20),
                  _fileDropZone(context),
                  if (_filePath != null) ...[
                    const SizedBox(height: 24),
                    const Text('SELECT OUTPUT FORMAT',
                        style: AppTextStyles.sectionLabel),
                    const SizedBox(height: 12),
                    _formatGrid(),
                  ],
                  if (_isConverting) _progressSection(),
                  if (_errorMessage != null) _buildErrorCard(),
                  if (_outputPath != null && !_isConverting)
                    _buildSuccessCard(),
                  if (_filePath != null && !_isConverting)
                    _buildOutputLocation(context),
                  const SizedBox(height: 32),
                  _convertButton(),
                ],
              ),
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
            width: 2,
            height: 2,
            child: PandocBridgeView(controller: _pandocBridge),
          ),
        ],
      ),
    );
  }

  Widget _buildOutputLocation(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return FutureBuilder<String>(
      future:
          FileService.getOutputDirectoryForCategory(_selectedOutputCategory()),
      builder: (ctx, snap) {
        if (!snap.hasData) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 24),
            Text(
              'SAVE TO',
              style: AppTextStyles.sectionLabel.copyWith(
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.lightTextSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkCard : AppColors.lightCard,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isDark
                      ? AppColors.darkCardBorder
                      : AppColors.lightCardBorder,
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.folder_outlined,
                      size: 18, color: AppColors.primaryIndigo),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      FileService.getDisplayPath(snap.data!),
                      style: AppTextStyles.fieldLabel,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    'Default',
                    style: AppTextStyles.caption.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.lightTextSecondary,
                    ),
                  ),
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
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primaryIndigo.withAlpha(25),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.primaryIndigo.withAlpha(80)),
      ),
      child: const Row(
        children: [
          Icon(Icons.offline_bolt, size: 14, color: AppColors.primaryIndigo),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Bundled Pandoc engine — document conversion stays on-device',
              style: AppTextStyles.caption,
            ),
          ),
        ],
      ),
    );
  }

  Widget _engineStatusCard() {
    return AnimatedBuilder(
      animation: _pandocBridge,
      builder: (context, _) {
        final hasFatalError = _pandocBridge.fatalError != null;
        final isReady = _pandocBridge.isReady;
        final icon = hasFatalError
            ? Icons.error_outline
            : isReady
                ? Icons.check_circle_outline
                : Icons.memory_outlined;
        final color = hasFatalError
            ? AppColors.audioRose
            : isReady
                ? AppColors.successTeal
                : AppColors.compressOrange;
        final subtitle = hasFatalError
            ? _pandocBridge.statusMessage
            : isReady
                ? '${_pandocBridge.statusMessage} First launch may take a few seconds.'
                : '${_pandocBridge.statusMessage} This only happens the first time the engine warms up.';

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: color.withAlpha(18),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withAlpha(70)),
          ),
          child: Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isReady
                          ? 'Document Engine Ready'
                          : 'Preparing Document Engine',
                      style: AppTextStyles.bodyText
                          .copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: AppTextStyles.caption,
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
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
          border: Border.all(
            color: Colors.grey.withAlpha(100),
            width: 1.5,
            style: BorderStyle.solid,
          ),
        ),
        child: _filePath == null
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.description_outlined,
                      size: 32, color: Colors.grey),
                  const SizedBox(height: 8),
                  const Text('Tap to select document',
                      style: AppTextStyles.bodyText),
                  const SizedBox(height: 4),
                  Text(
                    'DOCX · PPTX · XLSX · ODT · PDF · HTML · TXT · RTF · EPUB · MD',
                    style: AppTextStyles.caption.copyWith(color: Colors.grey),
                  ),
                ],
              )
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Text(
                        'Last Error: $_errorMessage',
                        style: const TextStyle(color: Colors.red, fontSize: 10),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.check_circle,
                          color: AppColors.successTeal, size: 20),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          _fileName!,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.bodyText
                              .copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        FileService.formatFileSize(_fileSizeBytes!),
                        style:
                            AppTextStyles.caption.copyWith(color: Colors.grey),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text('Tap to change file',
                      style: AppTextStyles.caption),
                ],
              ),
      ),
    );
  }

  Widget _formatGrid() {
    List<String> formats = const [
      'pdf',
      'docx',
      'odt',
      'html',
      'txt',
      'rtf',
      'epub',
      'md'
    ];
    if (_filePath != null) {
      final ext = _normalizedInputExtension(_filePath!);
      final allowed = AppConstants.documentOutputFormats[ext];
      if (allowed != null) {
        formats = allowed;
      }
    }
    
    // Ensure PDF is always an option if the input isn't already a PDF
    if (_filePath != null && _normalizedInputExtension(_filePath!) != 'pdf') {
      if (!formats.contains('pdf')) {
        formats = ['pdf', ...formats];
      }
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 2.2,
      ),
      itemCount: formats.length,
      itemBuilder: (context, index) {
        final format = formats[index];
        final isSelected = _selectedFormat == format;
        return GestureDetector(
          onTap: _isConverting
              ? null
              : () => setState(() => _selectedFormat = format),
          child: Container(
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primaryIndigo : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: isSelected ? AppColors.primaryIndigo : Colors.grey),
            ),
            child: Text(
              format.toUpperCase(),
              style: AppTextStyles.buttonLabel.copyWith(
                color: isSelected ? Colors.white : Colors.grey,
                fontSize: 12,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _progressSection() {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$_progressLabel ${(_progress * 100).toInt()}%',
            style: AppTextStyles.bodyText,
          ),
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
        decoration: BoxDecoration(
          color: Colors.red.withAlpha(20),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(_errorMessage!,
            style: const TextStyle(color: Colors.red, fontSize: 13)),
      ),
    );
  }

  Widget _buildSuccessCard() {
    return SuccessCard(
      outputPath: _outputPath!,
      label: 'Document converted successfully',
      onConvertAnother: _resetForm,
    );
  }

  Widget _convertButton() {
    final canConvert = _filePath != null && _selectedFormat != null && !_isConverting;

    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: canConvert ? _onConvert : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryIndigo,
          foregroundColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: _isConverting
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 2),
              )
            : const Text('Convert Now', style: AppTextStyles.buttonLabel),
      ),
    );
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: AppConstants.documentInputFormats,
    );
    if (result != null && result.files.single.path != null) {
      final path = result.files.single.path!;
      final extension = _normalizedInputExtension(path);
      if (!AppConstants.documentOutputFormats.containsKey(extension)) {
        setState(() {
          _errorMessage =
              'This document format is not supported yet.';
        });
        return;
      }

      setState(() {
        _filePath = path;
        _fileName = result.files.single.name;
        _fileSizeBytes = result.files.single.size;
        _selectedFormat = null;
        _errorMessage = null;
        _outputPath = null;
      });
    }
  }

  Future<void> _onConvert() async {
    setState(() {
      _isConverting = true;
      _errorMessage = null;
      _progress = 0.02;
      _progressLabel = 'Preparing document...';
    });

    final provider = context.read<TaskProvider>();
    final taskId = provider.addTask(
        '$_fileName → ${_selectedFormat!.toUpperCase()}', 'convert');

    try {
      final outputPath = await ConvertService.convertDocument(
        bridge: _pandocBridge,
        inputFilePath: _filePath!,
        outputFormat: _selectedFormat!,
        onStage: (stage) {
          if (!mounted) {
            return;
          }
          setState(() => _progressLabel = stage);
        },
        onProgress: (progress) {
          if (!mounted) {
            return;
          }
          setState(() => _progress = progress);
          provider.updateProgress(taskId, progress);
        },
      );

      provider.completeTask(taskId, outputPath);
      if (mounted) {
        setState(() {
          _outputPath = outputPath;
          _isConverting = false;
          _progressLabel = 'Done';
        });
      }
    } catch (error) {
      provider.failTask(taskId, error.toString());
      if (mounted) {
        setState(() {
          _errorMessage = error.toString().replaceFirst('Exception: ', '');
          _isConverting = false;
          _progressLabel = 'Conversion failed';
        });
      }
    }
  }

  void _resetForm() {
    setState(() {
      _filePath = null;
      _fileName = null;
      _fileSizeBytes = null;
      _selectedFormat = null;
      _outputPath = null;
      _errorMessage = null;
      _progress = 0.0;
      _progressLabel = 'Preparing document...';
    });
  }

  String _normalizedInputExtension(String path) {
    final ext = path.split('.').last.toLowerCase();
    if (ext == 'htm') {
      return 'html';
    }
    return ext;
  }

  OutputCategory _selectedOutputCategory() {
    return _selectedFormat == 'pdf'
        ? OutputCategory.pdfs
        : OutputCategory.documents;
  }
}
