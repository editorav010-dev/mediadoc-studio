import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/task.dart';
import '../models/task_status.dart';
import '../providers/task_provider.dart';
import '../services/file_service.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Recent Activity'),
        actions: [
          Consumer<TaskProvider>(
            builder: (ctx, provider, _) => provider.tasks.isEmpty
                ? const SizedBox.shrink()
                : TextButton(
                    onPressed: () => _confirmClear(context, provider),
                    child: Text('Clear All',
                        style: AppTextStyles.caption.copyWith(color: AppColors.audioRose)),
                  ),
          ),
        ],
      ),
      body: Consumer<TaskProvider>(
        builder: (ctx, provider, _) {
          if (provider.tasks.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.history_outlined, size: 56,
                      color: textSecondary.withAlpha(100)),
                  const SizedBox(height: 16),
                  Text('No activity yet', style: AppTextStyles.featureTitle.copyWith(color: textSecondary)),
                  const SizedBox(height: 6),
                  Text('Completed tasks will appear here',
                      style: AppTextStyles.caption.copyWith(color: textSecondary.withAlpha(150))),
                ],
              ),
            );
          }

          // Group tasks: active first, then completed newest-first
          final active = provider.activeTasks;
          final completed = provider.completedTasks; // TaskProvider handles reversal

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (active.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text('ACTIVE', style: AppTextStyles.sectionLabel.copyWith(color: textSecondary)),
                ),
                ...active.map((t) => _TaskHistoryCard(task: t, isDark: isDark)),
                const SizedBox(height: 20),
              ],
              if (completed.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text('COMPLETED', style: AppTextStyles.sectionLabel.copyWith(color: textSecondary)),
                ),
                ...completed.map((t) => _TaskHistoryCard(task: t, isDark: isDark)),
              ],
            ],
          );
        },
      ),
    );
  }

  void _confirmClear(BuildContext context, TaskProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear History'),
        content: const Text('Remove all completed tasks from history?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () { provider.clearCompleted(); Navigator.pop(ctx); },
            child: const Text('Clear', style: TextStyle(color: AppColors.audioRose)),
          ),
        ],
      ),
    );
  }
}

class _TaskHistoryCard extends StatelessWidget {
  final Task task;
  final bool isDark;
  const _TaskHistoryCard({required this.task, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final textSecondary = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    Color statusColor;
    IconData statusIcon;
    String statusText;

    switch (task.status) {
      case TaskStatus.success:
        statusColor = AppColors.successTeal;
        statusIcon = Icons.check_circle_outline;
        statusText = 'Complete';
        break;
      case TaskStatus.failed:
        statusColor = AppColors.audioRose;
        statusIcon = Icons.error_outline;
        statusText = 'Failed';
        break;
      case TaskStatus.running:
        statusColor = AppColors.primaryIndigo;
        statusIcon = Icons.sync;
        statusText = '${(task.progress * 100).toInt()}%';
        break;
      case TaskStatus.queued:
        statusColor = AppColors.warningAmber;
        statusIcon = Icons.schedule;
        statusText = 'Queued';
        break;
      case TaskStatus.cancelled:
        statusColor = textSecondary;
        statusIcon = Icons.cancel_outlined;
        statusText = 'Cancelled';
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(statusIcon, size: 16, color: statusColor),
            const SizedBox(width: 8),
            Expanded(child: Text(task.label,
                style: AppTextStyles.bodyText, overflow: TextOverflow.ellipsis)),
            Text(statusText, style: AppTextStyles.caption.copyWith(
                color: statusColor, fontWeight: FontWeight.w600)),
          ]),

          if (task.status == TaskStatus.running) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: task.progress,
                minHeight: 4,
                backgroundColor: AppColors.primaryIndigo.withAlpha(30),
                valueColor: const AlwaysStoppedAnimation(AppColors.primaryIndigo),
              ),
            ),
          ],

          if (task.status == TaskStatus.failed && task.errorMessage != null) ...[
            const SizedBox(height: 6),
            Text(task.errorMessage!,
                style: AppTextStyles.caption.copyWith(color: AppColors.audioRose),
                maxLines: 2, overflow: TextOverflow.ellipsis),
          ],

          if (task.status == TaskStatus.success && task.outputPath != null) ...[
            const SizedBox(height: 10),
            Row(children: [
              _MiniButton(
                icon: Icons.open_in_new, label: 'Open',
                color: AppColors.successTeal,
                onTap: () => FileService.openFile(task.outputPath!),
              ),
              const SizedBox(width: 8),
              _MiniButton(
                icon: Icons.folder_open_outlined, label: 'Show in Folder',
                color: AppColors.primaryIndigo,
                onTap: () => FileService.showInFolder(task.outputPath!),
              ),
            ]),
          ],
        ],
      ),
    );
  }
}

class _MiniButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _MiniButton({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: color.withAlpha(60)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(label, style: AppTextStyles.caption.copyWith(color: color, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}
