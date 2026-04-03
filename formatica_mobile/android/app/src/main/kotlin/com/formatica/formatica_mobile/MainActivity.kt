package com.formatica.formatica_mobile

import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.formatica/platform"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "scanMediaFile" -> {
                        val path = call.argument<String>("path")
                        if (path != null) {
                            MediaScannerConnection.scanFile(
                                this, arrayOf(path), null
                            ) { _, uri ->
                                runOnUiThread {
                                    result.success(uri?.toString() ?: "scanned")
                                }
                            }
                        } else {
                            result.error("INVALID_PATH", "Path is null", null)
                        }
                    }
                    "openFolder" -> {
                        val path = call.argument<String>("path")
                        if (path != null) {
                            try {
                                // Try opening with file manager
                                val intent = Intent(Intent.ACTION_VIEW)
                                val uri = Uri.parse("content://com.android.externalstorage.documents/document/primary:${path.removePrefix("/storage/emulated/0/")}")
                                intent.setDataAndType(uri, "resource/folder")
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                
                                if (intent.resolveActivity(packageManager) != null) {
                                    startActivity(intent)
                                } else {
                                    // Fallback: open with any file browser
                                    val fallback = Intent(Intent.ACTION_VIEW)
                                    fallback.setDataAndType(Uri.parse("file://$path"), "*/*")
                                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    try {
                                        startActivity(fallback)
                                    } catch (e: Exception) {
                                        // Last resort: open Downloads folder
                                        val downloads = Intent(Intent.ACTION_VIEW)
                                        downloads.setDataAndType(
                                            Uri.parse("content://com.android.externalstorage.documents/root/primary"),
                                            "vnd.android.document/root"
                                        )
                                        downloads.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        startActivity(downloads)
                                    }
                                }
                                result.success(true)
                            } catch (e: Exception) {
                                result.error("OPEN_FAILED", e.message, null)
                            }
                        } else {
                            result.error("INVALID_PATH", "Path is null", null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
