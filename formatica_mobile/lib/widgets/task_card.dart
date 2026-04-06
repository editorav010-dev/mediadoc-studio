import 'package:flutter/material.dart';
import '../models/task.dart';
import '../models/task_status.dart';
import 'progress_bar.dart';

class TaskCard extends StatelessWidget {
  final Task task;
  final VoidCallback? onCancel;
  final VoidCallback? onOpenFile;
  final VoidCallback? onRetry;

  const TaskCard({
    super.key,
    required this.task,
    this.onCancel,
    this.onOpenFile,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    Color borderColor;
    Widget? statusWidget;
    List<Widget> actions = [];

    switch (task.status) {
      case TaskStatus.queued:
      case TaskStatus.running:
        borderColor = Colors.blue;
        statusWidget = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            ProgressBar(value: task.progress),
          ],
        );
        if (onCancel != null) {
          actions.add(IconButton(
            icon: const Icon(Icons.cancel_outlined),
            onPressed: onCancel,
            tooltip: "Cancel",
          ));
        }
        break;
      case TaskStatus.success:
        borderColor = Colors.green;
        statusWidget = const Text(
          "Conversion complete",
          style: TextStyle(color: Colors.green, fontSize: 13),
        );
        if (onOpenFile != null) {
          actions.add(TextButton.icon(
            onPressed: onOpenFile,
            icon: const Icon(Icons.open_in_new, size: 18),
            label: const Text("Open File"),
          ));
        }
        break;
      case TaskStatus.failed:
        borderColor = Colors.red;
        statusWidget = Text(
          task.errorMessage ?? "An error occurred",
          style: const TextStyle(color: Colors.red, fontSize: 13),
        );
        if (onRetry != null) {
          actions.add(TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text("Retry"),
          ));
        }
        // Export diagnostics TODO stub
        actions.add(TextButton(
          onPressed: () {
            // TODO: Implement export diagnostics
          },
          child: const Text("Diagnostics", style: TextStyle(fontSize: 12)),
        ));
        break;
      case TaskStatus.cancelled:
        borderColor = Colors.grey;
        statusWidget = const Text(
          "Cancelled",
          style: TextStyle(color: Colors.grey, fontSize: 13),
        );
        break;
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(color: borderColor, width: 4),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      task.label,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  ...actions,
                ],
              ),
              statusWidget,
            ],
          ),
        ),
      ),
    );
  }
}
