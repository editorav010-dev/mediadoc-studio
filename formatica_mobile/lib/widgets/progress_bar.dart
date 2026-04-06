import 'package:flutter/material.dart';

class ProgressBar extends StatelessWidget {
  final double value; // 0.0 to 1.0
  final String? label;

  const ProgressBar({
    super.key,
    required this.value,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    final String displayLabel = label ?? "${(value * 100).toInt()}%";

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value > 0 ? value : null,
            minHeight: 8,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          displayLabel,
          style: TextStyle(
            fontSize: 11,
            color: Theme.of(context).hintColor,
          ),
        ),
      ],
    );
  }
}
