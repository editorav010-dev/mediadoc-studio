import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/theme.dart';
import 'core/router.dart';
import 'providers/task_provider.dart';
import 'widgets/task_monitor_overlay.dart';

final ValueNotifier<ThemeMode> themeNotifier = ValueNotifier(ThemeMode.dark);

/// Load persisted theme on app start
Future<void> loadSavedTheme() async {
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString('theme') ?? 'dark';
  themeNotifier.value = saved == 'light' ? ThemeMode.light : ThemeMode.dark;
}

class FormaticaApp extends StatelessWidget {
  const FormaticaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TaskProvider()),
      ],
      child: ValueListenableBuilder<ThemeMode>(
        valueListenable: themeNotifier,
        builder: (ctx, mode, _) => MaterialApp(
          title: "Formatica",
          theme: AppTheme.lightTheme(),
          darkTheme: AppTheme.darkTheme(),
          themeMode: mode,
          initialRoute: "/",
          routes: AppRouter.routes,
          debugShowCheckedModeBanner: false,
          builder: (context, child) {
            // Wrap every screen with the task monitor overlay
            return Stack(
              children: [
                child ?? const SizedBox.shrink(),
                const TaskMonitorOverlay(),
              ],
            );
          },
        ),
      ),
    );
  }
}
