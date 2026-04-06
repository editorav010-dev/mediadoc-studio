import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/audio_service.dart';
import '../services/file_service.dart';
import '../providers/task_provider.dart';
import '../widgets/success_card.dart';

class ExtractAudioScreen extends StatefulWidget {
  const ExtractAudioScreen({super.key});

  @override
  State<ExtractAudioScreen> createState() => _ExtractAudioScreenState();
}

class _ExtractAudioScreenState extends State<ExtractAudioScreen> {
  String? _filePath;
  String? _fileName;
  int? _fileSizeBytes;
  String _selectedFormat = 'mp3';
  String _selectedBitrate = '192k';
  bool _isExtracting = false;
  double _progress = 0.0;
  String? _errorMessage;
  String? _outputPath;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Extract Audio'),
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
                const Text('OUTPUT FORMAT', style: AppTextStyles.sectionLabel),
                const SizedBox(height: 12),
                _formatChips(),
                const SizedBox(height: 24),
                const Text('QUALITY (BITRATE)', style: AppTextStyles.sectionLabel),
                const SizedBox(height: 12),
                _bitrateChips(),
                const SizedBox(height: 8),
                Text(
                  '128k — smaller file    192k — balanced    320k — best quality',
                  style: AppTextStyles.caption.copyWith(
                      color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
                ),
              ],
              if (_filePath != null && !_isExtracting) _buildOutputLocation(context),
              if (_isExtracting) _progressSection(),
              if (_errorMessage != null) _buildErrorCard(),
              if (_outputPath != null && !_isExtracting) _buildSuccessCard(),
              const SizedBox(height: 32),
              _extractButton(),
            ],
          ),
        ),
      ),
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
          Icon(Icons.lock_outline, size: 14, color: AppColors.successTeal),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Processed entirely on-device. No upload required.',
              style: AppTextStyles.caption,
            ),
          ),
        ],
      ),
    );
  }

  Widget _fileDropZone(BuildContext context) {
    return GestureDetector(
      onTap: _isExtracting ? null : _pickFile,
      child: Container(
        height: 120,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.withAlpha(100), width: 1.5),
        ),
        child: _filePath == null
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.video_library_outlined, size: 32, color: Colors.grey),
                  const SizedBox(height: 8),
                  const Text('Select Video File', style: AppTextStyles.bodyText),
                  const SizedBox(height: 4),
                  Text('MP4 · MKV · MOV · AVI', style: AppTextStyles.caption.copyWith(color: Colors.grey)),
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

  Widget _formatChips() {
    final formats = ['mp3', 'wav', 'aac'];
    return Wrap(
      spacing: 8,
      children: formats.map((f) {
        final active = _selectedFormat == f;
        return GestureDetector(
          onTap: _isExtracting ? null : () => setState(() => _selectedFormat = f),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            decoration: BoxDecoration(
              color: active ? AppColors.primaryIndigo : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: active ? AppColors.primaryIndigo : Colors.grey),
            ),
            child: Text(
              f.toUpperCase(),
              style: AppTextStyles.buttonLabel.copyWith(color: active ? Colors.white : Colors.grey),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _bitrateChips() {
    final bitrates = ['128k', '192k', '256k', '320k'];
    return Wrap(
      spacing: 8,
      children: bitrates.map((b) {
        final active = _selectedBitrate == b;
        return GestureDetector(
          onTap: _isExtracting ? null : () => setState(() => _selectedBitrate = b),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: active ? AppColors.primaryIndigo : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: active ? AppColors.primaryIndigo : Colors.grey),
            ),
            child: Text(
              b,
              style: AppTextStyles.caption.copyWith(
                color: active ? Colors.white : Colors.grey,
                fontWeight: active ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _progressSection() {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Extracting audio… ${(_progress * 100).toInt()}%', style: AppTextStyles.bodyText),
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
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.audioRose.withAlpha(20),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.audioRose.withAlpha(60)),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline, color: AppColors.audioRose, size: 18),
            const SizedBox(width: 10),
            Expanded(child: Text(_errorMessage!, style: AppTextStyles.bodyText.copyWith(color: AppColors.audioRose))),
          ],
        ),
      ),
    );
  }

  Widget _buildSuccessCard() {
    return SuccessCard(
      outputPath: _outputPath!,
      label: 'Task complete',
      onConvertAnother: _resetForm,
    );
  }

  Widget _extractButton() {
    final canExtract = _filePath != null && !_isExtracting;
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: canExtract ? _onExtract : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryIndigo,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: _isExtracting
            ? const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                  SizedBox(width: 12),
                  Text('Extracting…', style: AppTextStyles.buttonLabel),
                ],
              )
            : const Text('Extract Audio', style: AppTextStyles.buttonLabel),
      ),
    );
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.video);
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

  Future<void> _onExtract() async {
    setState(() { _isExtracting = true; _errorMessage = null; });
    final provider = context.read<TaskProvider>();
    final taskId = provider.addTask(
      '$_fileName → ${_selectedFormat.toUpperCase()}',
      'extractAudio',
    );

    try {
      final outputPath = await AudioService.extractAudio(
        inputFilePath: _filePath!,
        outputFormat: _selectedFormat,
        bitrate: _selectedBitrate,
        onProgress: (p) {
          setState(() => _progress = p);
          provider.updateProgress(taskId, p);
        },
      );
      provider.completeTask(taskId, outputPath);
      setState(() { _outputPath = outputPath; _isExtracting = false; });
    } catch (e) {
      provider.failTask(taskId, e.toString());
      setState(() { _errorMessage = e.toString(); _isExtracting = false; });
    }
  }

  void _resetForm() {
    setState(() {
      _filePath = null;
      _fileName = null;
      _outputPath = null;
    });
  }

  Widget _buildOutputLocation(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return FutureBuilder<String>(
      future: FileService.getOutputDirectoryForCategory(OutputCategory.audio),
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
                      FileService.getDisplayPath(snap.data!),
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
}
