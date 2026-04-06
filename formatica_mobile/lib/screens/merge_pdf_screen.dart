import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/pdf_tools_service.dart';
import '../services/file_service.dart';
import '../providers/task_provider.dart';
import '../widgets/success_card.dart';

class MergePdfScreen extends StatefulWidget {
  const MergePdfScreen({super.key});

  @override
  State<MergePdfScreen> createState() => _MergePdfScreenState();
}

class _MergePdfScreenState extends State<MergePdfScreen> {
  final List<PlatformFile> _selectedFiles = [];
  bool _isConverting = false;
  double _progress = 0.0;
  String? _errorMessage;
  String? _outputPath;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Merge PDFs'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _privacyBadge(context),
              const SizedBox(height: 20),
              _addFilesButton(),
              if (_selectedFiles.isNotEmpty) ...[
                const SizedBox(height: 24),
                const Text('SELECTED FILES (DRAG TO REORDER)', style: AppTextStyles.sectionLabel),
                const SizedBox(height: 12),
                _reorderableList(),
              ],
              if (_isConverting) _progressSection(),
              if (_errorMessage != null) _buildErrorCard(),
              if (_outputPath != null && !_isConverting) _buildSuccessCard(),
              if (_selectedFiles.length >= 2 && !_isConverting) _buildOutputLocation(context),
              const SizedBox(height: 32),
              _mergeButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOutputLocation(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return FutureBuilder<String>(
      future: FileService.getOutputDirectoryForCategory(OutputCategory.pdfs),
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

  Widget _addFilesButton() {
    return GestureDetector(
      onTap: _isConverting ? null : _pickFiles,
      child: Container(
        height: 120,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.withAlpha(100), width: 1.5, style: BorderStyle.solid),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.picture_as_pdf_outlined, size: 32, color: Colors.grey),
            const SizedBox(height: 8),
            const Text('Tap to Add PDFs', style: AppTextStyles.bodyText),
            const SizedBox(height: 4),
            Text('Must be PDF format', style: AppTextStyles.caption.copyWith(color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _reorderableList() {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 300),
      child: ReorderableListView.builder(
        shrinkWrap: true,
        physics: const BouncingScrollPhysics(),
        itemCount: _selectedFiles.length,
        onReorder: (oldIndex, newIndex) {
          setState(() {
            if (newIndex > oldIndex) {
              newIndex -= 1;
            }
            final item = _selectedFiles.removeAt(oldIndex);
            _selectedFiles.insert(newIndex, item);
          });
        },
        itemBuilder: (context, index) {
          final file = _selectedFiles[index];
          return Card(
            key: ValueKey(file.path),
            margin: const EdgeInsets.only(bottom: 8),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            child: ListTile(
              leading: const Icon(Icons.picture_as_pdf, color: Colors.redAccent),
              title: Text(file.name, overflow: TextOverflow.ellipsis, maxLines: 1),
              subtitle: Text(FileService.formatFileSize(file.size), style: const TextStyle(fontSize: 12)),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.grey),
                    onPressed: _isConverting ? null : () {
                      setState(() {
                        _selectedFiles.removeAt(index);
                      });
                    },
                  ),
                  const Icon(Icons.drag_handle, color: Colors.grey),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _progressSection() {
    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Merging... ${(_progress * 100).toInt()}%', style: AppTextStyles.bodyText),
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
      label: 'PDFs merged successfully',
      onConvertAnother: _resetForm,
    );
  }

  Widget _mergeButton() {
    final canConvert = _selectedFiles.length >= 2 && !_isConverting;
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
            : const Text('Merge PDFs', style: AppTextStyles.buttonLabel),
      ),
    );
  }

  Future<void> _pickFiles() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf'],
      allowMultiple: true,
    );
    if (result != null) {
      setState(() {
        for (var file in result.files) {
          if (!_selectedFiles.any((f) => f.path == file.path)) {
            _selectedFiles.add(file);
          }
        }
        _errorMessage = null;
        _outputPath = null;
      });
    }
  }

  Future<void> _onConvert() async {
    setState(() { _isConverting = true; _errorMessage = null; });
    final provider = context.read<TaskProvider>();
    final taskId = provider.addTask('Merge ${_selectedFiles.length} PDFs', 'mergePdf');
    setState(() { _progress = 0.02; });

    try {
      final filePaths = _selectedFiles.map((f) => f.path!).toList();
      final outputPath = await PdfToolsService.mergePdfs(
        filePaths: filePaths,
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
      _selectedFiles.clear();
      _outputPath = null;
    });
  }
}
