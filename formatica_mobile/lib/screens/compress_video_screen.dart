import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../services/video_service.dart';
import '../services/file_service.dart';
import '../providers/task_provider.dart';
import '../widgets/success_card.dart';

class CompressVideoScreen extends StatefulWidget {
  const CompressVideoScreen({super.key});

  @override
  State<CompressVideoScreen> createState() => _CompressVideoScreenState();
}

class _CompressVideoScreenState extends State<CompressVideoScreen> {
  String? _filePath;
  String? _fileName;
  int? _fileSizeBytes;
  
  double _crf = 28;
  String _preset = 'medium';
  String _resolution = 'Original';
  
  bool _isConverting = false;
  double _progress = 0.0;
  String? _errorMessage;
  String? _outputPath;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Compress Video'),
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
                const Text('COMPRESSION QUALITY (CRF)', style: AppTextStyles.sectionLabel),
                const SizedBox(height: 12),
                _crfSlider(),
                const SizedBox(height: 24),
                const Text('SPEED / EFFICIENCY', style: AppTextStyles.sectionLabel),
                const SizedBox(height: 12),
                _presetSelector(),
                const SizedBox(height: 24),
                const Text('MAX RESOLUTION', style: AppTextStyles.sectionLabel),
                const SizedBox(height: 12),
                _resolutionSelector(),
              ],
              if (_isConverting) _progressSection(),
              if (_errorMessage != null) _buildErrorCard(),
              if (_outputPath != null && !_isConverting) _buildSuccessCard(),
              if (_filePath != null && !_isConverting) _buildOutputLocation(context),
              const SizedBox(height: 32),
              _convertButton(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOutputLocation(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return FutureBuilder<String>(
      future: FileService.getOutputDirectoryForCategory(OutputCategory.videos),
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
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.compress_outlined, size: 32, color: Colors.grey),
                  const SizedBox(height: 8),
                  const Text('Tap to select video', style: AppTextStyles.bodyText),
                  const SizedBox(height: 4),
                  Text('MP4 · MKV · AVI · MOV · WEBM', style: AppTextStyles.caption.copyWith(color: Colors.grey)),
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

  Widget _crfSlider() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('18\n(Best Quality)', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: Colors.grey)),
            Text('${_crf.toInt()}', style: AppTextStyles.fieldLabel.copyWith(color: AppColors.primaryIndigo)),
            const Text('51\n(Smallest)', textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: Colors.grey)),
          ],
        ),
        Slider(
          value: _crf,
          min: 18,
          max: 51,
          divisions: 33,
          activeColor: AppColors.primaryIndigo,
          onChanged: _isConverting ? null : (val) => setState(() => _crf = val),
        ),
        if (_crf == 28)
          const Text('28 = Balanced Quality/Size', style: TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }

  Widget _presetSelector() {
    final presets = ['fast', 'medium', 'slow'];
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: presets.map((p) => Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4.0),
          child: GestureDetector(
            onTap: _isConverting ? null : () => setState(() => _preset = p),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: _preset == p ? AppColors.primaryIndigo : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _preset == p ? AppColors.primaryIndigo : Colors.grey),
              ),
              child: Text(
                p[0].toUpperCase() + p.substring(1),
                style: AppTextStyles.buttonLabel.copyWith(color: _preset == p ? Colors.white : Colors.grey, fontSize: 13),
              ),
            ),
          ),
        ),
      )).toList(),
    );
  }

  Widget _resolutionSelector() {
    final resolutions = ['Original', '1080p', '720p', '480p'];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 3.0,
      ),
      itemCount: 4,
      itemBuilder: (context, index) {
        final res = resolutions[index];
        final isSelected = _resolution == res;
        return GestureDetector(
          onTap: _isConverting ? null : () => setState(() => _resolution = res),
          child: Container(
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primaryIndigo : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: isSelected ? AppColors.primaryIndigo : Colors.grey),
            ),
            child: Text(
              res,
              style: AppTextStyles.buttonLabel.copyWith(color: isSelected ? Colors.white : Colors.grey, fontSize: 13),
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
          Text('Compressing... ${(_progress * 100).toInt()}%', style: AppTextStyles.bodyText),
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
      label: 'Video compressed successfully',
      onConvertAnother: _resetForm,
    );
  }

  Widget _convertButton() {
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
            : const Text('Compress Video', style: AppTextStyles.buttonLabel),
      ),
    );
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'],
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
    setState(() { _isConverting = true; _errorMessage = null; });
    final provider = context.read<TaskProvider>();
    final taskId = provider.addTask('Compress $_fileName', 'compressVideo');
    setState(() { _progress = 0.02; });

    String apiRes;
    switch (_resolution) {
      case '1080p': apiRes = '1920:-2'; break;
      case '720p': apiRes = '1280:-2'; break;
      case '480p': apiRes = '854:-2'; break;
      default: apiRes = 'original';
    }

    try {
      final outputPath = await VideoService.compressVideo(
        inputFilePath: _filePath!,
        crf: _crf.toInt(),
        preset: _preset,
        resolution: apiRes,
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
      _crf = 28;
      _preset = 'medium';
      _resolution = 'Original';
    });
  }
}
