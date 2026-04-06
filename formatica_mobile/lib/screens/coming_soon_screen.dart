import 'package:flutter/material.dart';
import '../core/theme.dart';

class ComingSoonScreen extends StatelessWidget {
  final String title;
  const ComingSoonScreen({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textSecondary = isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary;

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.rocket_launch_outlined,
                size: 64,
                color: AppColors.primaryIndigo.withAlpha(128),
              ),
              const SizedBox(height: 24),
              const Text(
                'Coming Soon',
                style: AppTextStyles.pageTitle,
              ),
              const SizedBox(height: 8),
              Text(
                'This feature will be available in the next update.',
                textAlign: TextAlign.center,
                style: AppTextStyles.bodyText.copyWith(color: textSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
