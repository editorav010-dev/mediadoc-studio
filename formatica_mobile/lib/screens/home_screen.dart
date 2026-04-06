import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../app.dart';
import 'package:provider/provider.dart';
import '../providers/task_provider.dart';
import '../core/theme.dart';
import '../services/file_service.dart';
import '../models/task.dart';
import '../models/task_status.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  // Feature data
  static const _features = [
    _FeatureItem('Convert Document', 'DOCX, ODT, HTML, TXT, RTF, EPUB', Icons.description_outlined, AppColors.primaryIndigo, '/convert'),
    _FeatureItem('Images to PDF', 'Combine images into one file', Icons.photo_library_outlined, AppColors.successTeal, '/imagesToPdf'),
    _FeatureItem('Extract Audio', 'MP3, AAC, WAV from video', Icons.music_note_outlined, AppColors.audioRose, '/extractAudio'),
    _FeatureItem('Convert Video', 'MP4, MKV, MOV, AVI, WEBM, GIF', Icons.video_file_outlined, AppColors.videoPurple, '/convertVideo'),
    _FeatureItem('Compress Video', 'Resize and reduce file size', Icons.compress_outlined, AppColors.compressOrange, '/compressVideo'),
    _FeatureItem('Convert Image', 'JPG, PNG, WEBP, GIF, BMP', Icons.image_outlined, AppColors.imageCyan, '/convertImage'),
    _FeatureItem('Merge PDF', 'Combine multiple PDFs into one', Icons.picture_as_pdf_outlined, AppColors.audioRose, '/mergePdf'),
    _FeatureItem('Split PDF', 'Extract pages from a PDF', Icons.splitscreen_outlined, AppColors.skyBlue, '/splitPdf'),
    _FeatureItem('Greyscale PDF', 'Convert PDF color to black & white', Icons.format_color_reset_outlined, Colors.grey, '/greyscalePdf'),
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textPrimary = isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary;
    final textSecondary = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // App header
            SliverToBoxAdapter(child: _buildHeader(context, textPrimary, textSecondary)),
            // On-device status ribbon
            const SliverToBoxAdapter(child: _OnDeviceRibbon()),
            // Section label
            SliverToBoxAdapter(child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
              child: Text('TOOLS', style: AppTextStyles.sectionLabel.copyWith(color: textSecondary)),
            )),
            // Feature list
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    if (i.isOdd) return const SizedBox(height: 8);
                    final feature = _features[i ~/ 2];
                    return _FeatureTile(feature: feature);
                  },
                  childCount: _features.length * 2 - 1,
                ),
              ),
            ),
            // Recent activity
            SliverToBoxAdapter(child: _RecentActivity()),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, Color textPrimary, Color textSecondary) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: AppColors.primaryIndigo,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Center(
              child: Text(
                'F',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Formatica', style: AppTextStyles.pageTitle),
                Text(
                  'Convert, extract, and transform — privately.',
                  style: AppTextStyles.caption.copyWith(color: textSecondary),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.history_outlined, size: 22),
            onPressed: () => Navigator.pushNamed(context, '/history'),
            tooltip: 'Recent Activity',
          ),
          ValueListenableBuilder<ThemeMode>(
            valueListenable: themeNotifier,
            builder: (ctx, mode, _) => IconButton(
              padding: EdgeInsets.zero,
              icon: Icon(
                mode == ThemeMode.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                size: 22,
              ),
              onPressed: () async {
                final next =
                    mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
                themeNotifier.value = next;
                final prefs = await SharedPreferences.getInstance();
                await prefs.setString(
                    'theme', next == ThemeMode.dark ? 'dark' : 'light');
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined, size: 22),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
            tooltip: 'Settings',
          ),
        ],
      ),
    );
  }
}

// On-device status ribbon
class _OnDeviceRibbon extends StatelessWidget {
  const _OnDeviceRibbon();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.successTeal.withAlpha(25),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.successTeal.withAlpha(80)),
      ),
      child: const Row(
        children: [
          Icon(Icons.offline_bolt, size: 14, color: AppColors.successTeal),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              '⚡ All tools run on-device — no backend required',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.successTeal),
            ),
          ),
        ],
      ),
    );
  }
}

// Feature tile — matches PDF list item style
class _FeatureTile extends StatelessWidget {
  final _FeatureItem feature;
  const _FeatureTile({required this.feature});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Card(
      child: InkWell(
        onTap: () => Navigator.pushNamed(context, feature.route),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 42, height: 42,
                decoration: BoxDecoration(
                  color: feature.color.withAlpha(30),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(feature.icon, color: feature.color, size: 22),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(feature.title, style: AppTextStyles.featureTitle),
                    const SizedBox(height: 2),
                    Text(
                      feature.subtitle,
                      style: AppTextStyles.caption.copyWith(
                        color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                size: 20,
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Simple data class
class _FeatureItem {
  final String title, subtitle, route;
  final IconData icon;
  final Color color;
  const _FeatureItem(this.title, this.subtitle, this.icon, this.color, this.route);
}

// Recent activity from TaskProvider
class _RecentActivity extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<TaskProvider>(
      builder: (ctx, provider, _) {
        final completed = provider.completedTasks;
        if (completed.isEmpty) return const SizedBox.shrink();
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final textSecondary = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
              child: Row(
                children: [
                  Text(
                    'RECENT ACTIVITY',
                    style: AppTextStyles.sectionLabel.copyWith(color: textSecondary),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => provider.clearCompleted(),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text(
                      'Clear',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryIndigo,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            ...completed.take(5).map((task) => _ActivityItem(task: task)),
          ],
        );
      },
    );
  }
}

class _ActivityItem extends StatelessWidget {
  final Task task;
  const _ActivityItem({required this.task});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      child: Row(
        children: [
          Icon(
            task.status == TaskStatus.success ? Icons.check_circle_outline : Icons.error_outline,
            size: 16,
            color: task.status == TaskStatus.success ? AppColors.successTeal : AppColors.audioRose,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              task.label,
              style: AppTextStyles.caption,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (task.status == TaskStatus.success && task.outputPath != null)
            GestureDetector(
              onTap: () => FileService.openFile(task.outputPath!),
              child: const Text(
                'Open',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryIndigo,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
