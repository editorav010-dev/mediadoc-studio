import 'package:flutter_test/flutter_test.dart';
import 'package:formatica_mobile/app.dart';

void main() {
  testWidgets('Formatica home screen renders key tools', (WidgetTester tester) async {
    await tester.pumpWidget(const FormaticaApp());
    await tester.pumpAndSettle();

    expect(find.text('Formatica'), findsOneWidget);
    expect(find.text('Convert Document'), findsOneWidget);
    expect(find.text('Compress Video'), findsOneWidget);
    expect(find.text('Images to PDF'), findsOneWidget);
  });
}
