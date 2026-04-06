import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/task.dart';
import '../models/task_status.dart';
import '../providers/task_provider.dart';
import '../services/file_service.dart';

/// Floating task monitor that shows active tasks from any screen.
/// Appears at the bottom when tasks are running, tappable to expand.
class TaskMonitorOverlay extends StatefulWidget {
  const TaskMonitorOverlay({super.key});

  @override
  State<TaskMonitorOverlay> createState() => _TaskMonitorOverlayState();
}

class _TaskMonitorOverlayState extends State<TaskMonitorOverlay>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Consumer<TaskProvider>(
      builder: (ctx, provider, _) {
        final active = provider.activeTasks;
        final recentDone = provider.tasks
            .where((t) => t.status == TaskStatus.success || t.status == TaskStatus.failed)
            .take(3)
            .toList();

        // Nothing to show
        if (active.isEmpty && recentDone.isEmpty) return const SizedBox.shrink();

        return Positioned(
          left: 12,
          right: 12,
          bottom: MediaQuery.of(context).padding.bottom + 8,
          child: Material(
            color: Colors.transparent,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOut,
              decoration: BoxDecoration(
                color: Theme.of(context).brightness == Brightness.dark
                    ? const Color(0xFF1E1E2E)
                    : const Color(0xFFF8F9FA),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: Theme.of(context).brightness == Brightness.dark
                      ? Colors.white.withAlpha(20)
                      : Colors.black.withAlpha(15),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withAlpha(40),
                    blurRadius: 20,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Header bar — always visible
                  GestureDetector(
                    onTap: () => setState(() => _expanded = !_expanded),
                    child: _buildHeader(active, recentDone),
                  ),
                  // Expanded list
                  if (_expanded) ...[
                    const Divider(height: 1),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 250),
                      child: ListView(
                        shrinkWrap: true,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        children: [
                          ...active.map((t) => _buildTaskTile(t, context)),
                          if (recentDone.isNotEmpty && active.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                              child: Text('RECENT',
                                  style: AppTextStyles.caption.copyWith(
                                      fontSize: 10, color: Colors.grey)),
                            ),
                          ...recentDone.map((t) => _buildTaskTile(t, context)),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeader(List<Task> active, List<Task> recentDone) {
    final count = active.length;
    final totalProgress = active.isEmpty
        ? 1.0
        : active.map((t) => t.progress).reduce((a, b) => a + b) / active.length;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Animated spinner or checkmark
          if (count > 0) ...[
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                value: totalProgress,
                strokeWidth: 2.5,
                color: AppColors.primaryIndigo,
                backgroundColor: AppColors.primaryIndigo.withAlpha(30),
              ),
            ),
          ] else ...[
            const Icon(Icons.check_circle, size: 18, color: AppColors.successTeal),
          ],
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              count > 0
                  ? '$count task${count > 1 ? 's' : ''} running • ${(totalProgress * 100).toInt()}%'
                  : 'All tasks complete',
              style: AppTextStyles.bodyText.copyWith(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
          Icon(
            _expanded ? Icons.keyboard_arrow_down : Icons.keyboard_arrow_up,
            size: 20,
            color: Colors.grey,
          ),
        ],
      ),
    );
  }

  Widget _buildTaskTile(Task task, BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    Color statusColor;
    IconData statusIcon;

    switch (task.status) {
      case TaskStatus.running:
        statusColor = AppColors.primaryIndigo;
        statusIcon = Icons.sync;
        break;
      case TaskStatus.queued:
        statusColor = AppColors.warningAmber;
        statusIcon = Icons.schedule;
        break;
      case TaskStatus.success:
        statusColor = AppColors.successTeal;
        statusIcon = Icons.check_circle;
        break;
      case TaskStatus.failed:
        statusColor = AppColors.audioRose;
        statusIcon = Icons.error;
        break;
      case TaskStatus.cancelled:
        statusColor = Colors.grey;
        statusIcon = Icons.cancel;
        break;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withAlpha(8) : Colors.black.withAlpha(5),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(statusIcon, size: 14, color: statusColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    task.label,
                    style: AppTextStyles.caption.copyWith(fontWeight: FontWeight.w600),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (task.status == TaskStatus.running)
                  Text(
                    '${(task.progress * 100).toInt()}%',
                    style: AppTextStyles.caption.copyWith(
                        color: statusColor, fontWeight: FontWeight.w700),
                  ),
                if (task.status == TaskStatus.success && task.outputPath != null)
                  GestureDetector(
                    onTap: () => FileService.openFile(task.outputPath!),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.successTeal.withAlpha(20),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('Open', style: TextStyle(
                          fontSize: 11, color: AppColors.successTeal, fontWeight: FontWeight.w600)),
                    ),
                  ),
              ],
            ),
            if (task.status == TaskStatus.running) ...[
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: task.progress,
                  minHeight: 3,
                  backgroundColor: statusColor.withAlpha(30),
                  valueColor: AlwaysStoppedAnimation(statusColor),
                ),
              ),
            ],
            if (task.status == TaskStatus.failed && task.errorMessage != null) ...[
              const SizedBox(height: 4),
              Text(task.errorMessage!,
                  style: AppTextStyles.caption.copyWith(color: AppColors.audioRose, fontSize: 10),
                  maxLines: 1, overflow: TextOverflow.ellipsis),
            ],
          ],
        ),
      ),
    );
  }
}
