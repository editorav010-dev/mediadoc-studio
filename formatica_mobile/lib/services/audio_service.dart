import 'package:path/path.dart' as p;
import 'package:ffmpeg_kit_flutter_new/ffmpeg_kit.dart';
import 'package:ffmpeg_kit_flutter_new/ffprobe_kit.dart';
import 'package:ffmpeg_kit_flutter_new/return_code.dart';
import 'package:ffmpeg_kit_flutter_new/statistics.dart';
import 'file_service.dart';

class AudioService {
  /// Extract audio from video — fully on-device
  static Future<String> extractAudio({
    required String inputFilePath,
    required String outputFormat,
    required String bitrate,
    required void Function(double) onProgress,
  }) async {
    onProgress(0.01);

    // Get duration for progress tracking
    int durationMs = 60000;
    try {
      final session = await FFprobeKit.getMediaInformation(inputFilePath);
      final info = session.getMediaInformation();
      if (info != null) {
        final d = info.getDuration();
        if (d != null) durationMs = (double.parse(d) * 1000).toInt();
      }
    } catch (_) {}
    onProgress(0.05);

    final base = p.basenameWithoutExtension(inputFilePath);
    final outDir = await FileService.getOutputDirectoryForCategory(OutputCategory.audio);
    final ts = DateTime.now().millisecondsSinceEpoch;
    final outPath = '$outDir/${base}_audio_$ts.$outputFormat';

    // Map output format to FFmpeg codec
    String codec;
    switch (outputFormat) {
      case 'mp3': codec = 'libmp3lame'; break;
      case 'aac': codec = 'aac'; break;
      case 'wav': codec = 'pcm_s16le'; break;
      case 'flac': codec = 'flac'; break;
      case 'ogg': codec = 'libvorbis'; break;
      default: codec = 'libmp3lame';
    }

    final cmd = '-i "$inputFilePath" -vn -c:a $codec -b:a $bitrate -y "$outPath"';

    final session = await FFmpegKit.executeAsync(
      cmd,
      (session) async {},
      (log) {},
      (Statistics stats) {
        final time = stats.getTime();
        if (durationMs > 0 && time > 0) {
          final progress = (time / durationMs).clamp(0.0, 0.95);
          onProgress(0.05 + progress * 0.90);
        }
      },
    );

    // Wait for completion
    while (true) {
      final state = await session.getState();
      if (state.toString().contains('COMPLETED') || state.toString().contains('FAILED')) break;
      await Future.delayed(const Duration(milliseconds: 500));
    }

    final rc = await session.getReturnCode();
    if (!ReturnCode.isSuccess(rc)) {
      final output = await session.getOutput();
      throw Exception('Audio extraction failed: ${output?.substring(0, 200) ?? "unknown"}');
    }

    await FileService.scanMediaFile(outPath);
    onProgress(1.0);
    return outPath;
  }
}
