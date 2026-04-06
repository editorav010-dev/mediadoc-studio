import 'task_status.dart';

class Task {
  final String id; // generated using DateTime.now().millisecondsSinceEpoch.toString()
  final String label; // e.g. "report.docx → PDF"
  final String featureType; // "convert" | "download" | "extractAudio" | "imagesToPdf"
  final TaskStatus status;
  final double progress; // 0.0 to 1.0
  final String? outputPath; // set on success
  final String? errorMessage; // set on failure

  Task({
    required this.id,
    required this.label,
    required this.featureType,
    this.status = TaskStatus.queued,
    this.progress = 0.0,
    this.outputPath,
    this.errorMessage,
  });

  Task copyWith({
    String? id,
    String? label,
    String? featureType,
    TaskStatus? status,
    double? progress,
    String? outputPath,
    String? errorMessage,
  }) {
    return Task(
      id: id ?? this.id,
      label: label ?? this.label,
      featureType: featureType ?? this.featureType,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      outputPath: outputPath ?? this.outputPath,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}
