import 'dart:collection';
import 'package:flutter/foundation.dart';
import '../models/task.dart';
import '../models/task_status.dart';

class TaskProvider with ChangeNotifier {
  final List<Task> _tasks = [];

  UnmodifiableListView<Task> get tasks => UnmodifiableListView(_tasks);

  int get runningCount => _tasks.where((t) => t.status == TaskStatus.running).length;

  List<Task> get activeTasks => _tasks
      .where((t) => t.status == TaskStatus.queued || t.status == TaskStatus.running)
      .toList();

  List<Task> get completedTasks => _tasks
      .where((t) =>
          t.status == TaskStatus.success ||
          t.status == TaskStatus.failed ||
          t.status == TaskStatus.cancelled)
      .toList()
      .reversed
      .toList();

  String addTask(String label, String featureType) {
    final String id = DateTime.now().millisecondsSinceEpoch.toString();
    final task = Task(
      id: id,
      label: label,
      featureType: featureType,
    );
    _tasks.add(task);
    notifyListeners();
    return id;
  }

  void updateProgress(String id, double progress) {
    final int index = _tasks.indexWhere((t) => t.id == id);
    if (index != -1) {
      _tasks[index] = _tasks[index].copyWith(
        status: TaskStatus.running,
        progress: progress,
      );
      notifyListeners();
    }
  }

  void completeTask(String id, String outputPath) {
    final int index = _tasks.indexWhere((t) => t.id == id);
    if (index != -1) {
      _tasks[index] = _tasks[index].copyWith(
        status: TaskStatus.success,
        progress: 1.0,
        outputPath: outputPath,
      );
      notifyListeners();
    }
  }

  void failTask(String id, String errorMessage) {
    final int index = _tasks.indexWhere((t) => t.id == id);
    if (index != -1) {
      _tasks[index] = _tasks[index].copyWith(
        status: TaskStatus.failed,
        errorMessage: errorMessage,
      );
      notifyListeners();
    }
  }

  void cancelTask(String id) {
    final int index = _tasks.indexWhere((t) => t.id == id);
    if (index != -1) {
      _tasks[index] = _tasks[index].copyWith(
        status: TaskStatus.cancelled,
      );
      notifyListeners();
    }
  }

  void clearCompleted() {
    _tasks.removeWhere((t) =>
        t.status == TaskStatus.success ||
        t.status == TaskStatus.failed ||
        t.status == TaskStatus.cancelled);
    notifyListeners();
  }
}
