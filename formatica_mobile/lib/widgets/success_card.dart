import 'dart:io';
import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../services/file_service.dart';

class SuccessCard extends StatelessWidget {
  final String outputPath;
  final String label;
  final VoidCallback? onConvertAnother;

  const SuccessCard({
    super.key,
    required this.outputPath,
    required this.label,
    this.onConvertAnother,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.successTeal.withAlpha(20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.successTeal.withAlpha(60)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.check_circle_outline, color: AppColors.successTeal, size: 18),
            const SizedBox(width: 8),
            Expanded(child: Text(
              label,
              style: AppTextStyles.bodyText.copyWith(
                color: AppColors.successTeal, fontWeight: FontWeight.w600),
            )),
          ]),
          const SizedBox(height: 8),
          // Show filename
          Text(
            FileService.getFileName(outputPath),
            style: AppTextStyles.bodyText.copyWith(fontWeight: FontWeight.w500),
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          // Show organized path + file size
          FutureBuilder<int>(
            future: File(outputPath).length(),
            builder: (ctx, snap) {
              final size = snap.hasData ? FileService.formatFileSize(snap.data!) : '...';
              return Text(
                '📂 ${FileService.getDisplayPath(outputPath)}  •  $size',
                style: AppTextStyles.caption.copyWith(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
                overflow: TextOverflow.ellipsis,
              );
            },
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _ActionButton(
              icon: Icons.open_in_new,
              label: 'Open File',
              onTap: () => FileService.openFile(outputPath),
              color: AppColors.successTeal,
            )),
            const SizedBox(width: 8),
            Expanded(child: _ActionButton(
              icon: Icons.folder_open_outlined,
              label: 'Show in Folder',
              onTap: () => FileService.showInFolder(outputPath),
              color: AppColors.primaryIndigo,
            )),
          ]),
          if (onConvertAnother != null) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: onConvertAnother,
                child: Text('Convert Another', style: AppTextStyles.buttonLabel.copyWith(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color color;

  const _ActionButton({required this.icon, required this.label, required this.onTap, required this.color});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 15, color: color),
      label: Text(label, style: AppTextStyles.buttonLabel.copyWith(color: color, fontSize: 12)),
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: color.withAlpha(100)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(vertical: 10),
      ),
    );
  }
}
