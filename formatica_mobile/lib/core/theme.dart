import 'package:flutter/material.dart';

class AppColors {
  // Brand
  static const Color primaryIndigo = Color(0xFF4F46E5);
  static const Color successTeal = Color(0xFF0D9488);
  static const Color audioRose = Color(0xFFE11D48);
  static const Color warningAmber = Color(0xFFF59E0B);
  static const Color videoPurple = Color(0xFF7C3AED);
  static const Color skyBlue = Color(0xFF0284C7);
  static const Color compressOrange = Color(0xFFEA580C);
  static const Color imageCyan = Color(0xFF0891B2);

  // Dark theme surfaces
  static const Color darkBg = Color(0xFF0F0F0F);
  static const Color darkCard = Color(0xFF1A1A1A);
  static const Color darkCardBorder = Color(0xFF2A2A2A);
  static const Color darkTextPrimary = Color(0xFFEFEFEF);
  static const Color darkTextSecondary = Color(0xFF888888);

  // Light theme surfaces
  static const Color lightBg = Color(0xFFF5F3EF);
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightCardBorder = Color(0xFFE8E5E0);
  static const Color lightTextPrimary = Color(0xFF1A1A1A);
  static const Color lightTextSecondary = Color(0xFF666666);
}

class AppTextStyles {
  static const TextStyle pageTitle = TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: -0.3);
  static const TextStyle featureTitle = TextStyle(fontSize: 14, fontWeight: FontWeight.w700);
  static const TextStyle buttonLabel = TextStyle(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 0.1);
  static const TextStyle bodyText = TextStyle(fontSize: 13, fontWeight: FontWeight.w400, height: 1.4);
  static const TextStyle fieldLabel = TextStyle(fontSize: 12, fontWeight: FontWeight.w400);
  static const TextStyle sectionLabel = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.2);
  static const TextStyle caption = TextStyle(fontSize: 11, fontWeight: FontWeight.w400);
}

class AppTheme {
  static ThemeData darkTheme() => ThemeData(
    brightness: Brightness.dark,
    useMaterial3: true,
    typography: Typography.material2021(),
    textTheme: ThemeData.dark().textTheme.apply(
      fontFamily: null,
      bodyColor: AppColors.darkTextPrimary,
      displayColor: AppColors.darkTextPrimary,
    ),
    scaffoldBackgroundColor: AppColors.darkBg,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.primaryIndigo,
      surface: AppColors.darkCard,
      onSurface: AppColors.darkTextPrimary,
    ),
    cardTheme: CardThemeData(
      color: AppColors.darkCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.darkCardBorder, width: 1),
      ),
      margin: EdgeInsets.zero,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.darkBg,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: AppTextStyles.pageTitle.copyWith(color: AppColors.darkTextPrimary),
      iconTheme: const IconThemeData(color: AppColors.darkTextPrimary),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.darkCardBorder, thickness: 1),
  );

  static ThemeData lightTheme() => ThemeData(
    brightness: Brightness.light,
    useMaterial3: true,
    typography: Typography.material2021(),
    textTheme: ThemeData.light().textTheme.apply(
      fontFamily: null,
      bodyColor: AppColors.lightTextPrimary,
      displayColor: AppColors.lightTextPrimary,
    ),
    scaffoldBackgroundColor: AppColors.lightBg,
    colorScheme: const ColorScheme.light(
      primary: AppColors.primaryIndigo,
      surface: AppColors.lightCard,
      onSurface: AppColors.lightTextPrimary,
    ),
    cardTheme: CardThemeData(
      color: AppColors.lightCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.lightCardBorder, width: 1),
      ),
      margin: EdgeInsets.zero,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.lightBg,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: AppTextStyles.pageTitle.copyWith(color: AppColors.lightTextPrimary),
      iconTheme: const IconThemeData(color: AppColors.lightTextPrimary),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.lightCardBorder, thickness: 1),
  );
}
