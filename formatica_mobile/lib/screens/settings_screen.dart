import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app.dart';
import '../core/theme.dart';
import '../services/file_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  int _storageUsed = 0;
  bool _loadingStorage = true;

  @override
  void initState() {
    super.initState();
    _loadInfo();
  }

  Future<void> _loadInfo() async {
    final used = await FileService.getTotalStorageUsed();
    if (mounted) {
      setState(() {
        _storageUsed = used;
        _loadingStorage = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _sectionLabel('APPEARANCE', textSecondary),
          const SizedBox(height: 8),
          _settingCard(
            isDark: isDark,
            icon: Icons.dark_mode_outlined,
            iconColor: AppColors.primaryIndigo,
            title: 'Dark Mode',
            trailing: Switch(
              value: themeNotifier.value == ThemeMode.dark,
              activeTrackColor: AppColors.primaryIndigo,
              onChanged: (value) async {
                final mode = value ? ThemeMode.dark : ThemeMode.light;
                themeNotifier.value = mode;
                final prefs = await SharedPreferences.getInstance();
                await prefs.setString('theme', value ? 'dark' : 'light');
                setState(() {});
              },
            ),
          ),
          const SizedBox(height: 24),
          _sectionLabel('DOCUMENT ENGINE', textSecondary),
          const SizedBox(height: 8),
          _settingCard(
            isDark: isDark,
            icon: Icons.offline_bolt_outlined,
            iconColor: AppColors.successTeal,
            title: 'Bundled Pandoc',
            subtitle: 'DOCX, ODT, HTML, TXT, RTF, EPUB and Markdown conversions run locally.',
          ),
          const SizedBox(height: 8),
          _settingCard(
            isDark: isDark,
            icon: Icons.schedule_outlined,
            iconColor: AppColors.compressOrange,
            title: 'First Launch Warm-up',
            subtitle: 'The document engine may take a few seconds the first time it starts.',
          ),
          const SizedBox(height: 24),
          _sectionLabel('OUTPUT LOCATION', textSecondary),
          const SizedBox(height: 8),
          _settingCard(
            isDark: isDark,
            icon: Icons.folder_outlined,
            iconColor: AppColors.successTeal,
            title: 'Output Folder',
            subtitle: 'Formatica /',
            trailing: IconButton(
              icon: const Icon(Icons.open_in_new, size: 18),
              onPressed: () async {
                final dir = await FileService.getBaseDirectory();
                await FileService.showInFolder(dir.path);
              },
            ),
          ),
          const SizedBox(height: 8),
          _folderStructureCard(isDark),
          const SizedBox(height: 24),
          _sectionLabel('STORAGE', textSecondary),
          const SizedBox(height: 8),
          _settingCard(
            isDark: isDark,
            icon: Icons.storage_outlined,
            iconColor: AppColors.compressOrange,
            title: 'Storage Used',
            subtitle: _loadingStorage
                ? 'Calculating...'
                : FileService.formatFileSize(_storageUsed),
            trailing: TextButton(
              onPressed: _confirmClearStorage,
              child: const Text(
                'Clear',
                style: TextStyle(color: AppColors.audioRose, fontSize: 12),
              ),
            ),
          ),
          const SizedBox(height: 24),
          _sectionLabel('ABOUT', textSecondary),
          const SizedBox(height: 8),
          _settingCard(
            isDark: isDark,
            icon: Icons.info_outline,
            iconColor: AppColors.skyBlue,
            title: 'Formatica',
            subtitle: 'Version 2.0.0 • 9 Tools',
          ),
          const SizedBox(height: 8),
          _settingCard(
            isDark: isDark,
            icon: Icons.lock_outline,
            iconColor: AppColors.primaryIndigo,
            title: 'Privacy',
            subtitle: 'All conversion tools run on-device. No backend is required.',
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text, Color color) {
    return Text(text, style: AppTextStyles.sectionLabel.copyWith(color: color));
  }

  Widget _settingCard({
    required bool isDark,
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    Widget? trailing,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: iconColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTextStyles.bodyText.copyWith(fontWeight: FontWeight.w600),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppTextStyles.caption.copyWith(
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.lightTextSecondary,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing,
        ],
      ),
    );
  }

  Widget _folderStructureCard(bool isDark) {
    final folders = [
      ('Documents', 'Converted files'),
      ('PDFs', 'PDF operations'),
      ('Audio', 'Extracted audio'),
      ('Videos', 'Converted and compressed'),
      ('Images', 'Converted images'),
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Folder Structure',
            style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          for (final folder in folders)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Text(
                    'Formatica/${folder.$1}/',
                    style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w500),
                  ),
                  const Spacer(),
                  Text(
                    folder.$2,
                    style: AppTextStyles.caption.copyWith(
                      fontSize: 10,
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.lightTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  void _confirmClearStorage() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear All Output Files'),
        content: const Text(
          'This will delete all files in the Formatica output folders. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final dir = await FileService.getBaseDirectory();
                if (await dir.exists()) {
                  await dir.delete(recursive: true);
                  await dir.create(recursive: true);
                }
                await _loadInfo();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('All output files cleared'),
                      backgroundColor: AppColors.successTeal,
                    ),
                  );
                }
              } catch (error) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Error: $error'),
                      backgroundColor: AppColors.audioRose,
                    ),
                  );
                }
              }
            },
            child: const Text(
              'Delete All',
              style: TextStyle(color: AppColors.audioRose),
            ),
          ),
        ],
      ),
    );
  }
}
