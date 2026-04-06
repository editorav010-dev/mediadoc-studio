import 'package:flutter/material.dart';
import '../screens/home_screen.dart';
import '../screens/history_screen.dart';
import '../screens/convert_screen.dart';
import '../screens/extract_audio_screen.dart';
import '../screens/images_to_pdf_screen.dart';
import '../screens/convert_video_screen.dart';
import '../screens/compress_video_screen.dart';
import '../screens/convert_image_screen.dart';
import '../screens/merge_pdf_screen.dart';
import '../screens/split_pdf_screen.dart';
import '../screens/greyscale_pdf_screen.dart';
import '../screens/settings_screen.dart';

class AppRouter {
  static Map<String, WidgetBuilder> routes = {
    "/": (context) => const HomeScreen(),
    "/history": (context) => const HistoryScreen(),
    "/convert": (context) => const ConvertScreen(),
    "/extractAudio": (context) => const ExtractAudioScreen(),
    "/imagesToPdf": (context) => const ImagesToPdfScreen(),
    "/convertVideo": (context) => const ConvertVideoScreen(),
    "/compressVideo": (context) => const CompressVideoScreen(),
    "/convertImage": (context) => const ConvertImageScreen(),
    "/mergePdf": (context) => const MergePdfScreen(),
    "/splitPdf": (context) => const SplitPdfScreen(),
    "/greyscalePdf": (context) => const GreyscalePdfScreen(),
    "/settings": (context) => const SettingsScreen(),
  };
}
