package com.formatica.formatica_mobile

import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import androidx.core.content.FileProvider
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
                                if (tryOpenFolderWithFileProvider(path)) {
                                    result.success(true)
                                    return@setMethodCallHandler
                                }

                                val intent = Intent(Intent.ACTION_VIEW)
                                val relative = path.removePrefix("/storage/emulated/0/")
                                    .removePrefix("/storage/emulated/0")
                                val uri = Uri.parse(
                                    "content://com.android.externalstorage.documents/document/primary:$relative"
                                )
                                intent.setDataAndType(uri, "resource/folder")
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

                                if (intent.resolveActivity(packageManager) != null) {
                                    startActivity(intent)
                                } else {
                                    val fallback = Intent(Intent.ACTION_VIEW)
                                    fallback.setDataAndType(
                                        Uri.parse("file://$path"),
                                        "*/*"
                                    )
                                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    try {
                                        startActivity(fallback)
                                    } catch (_: Exception) {
                                        val downloads = Intent(Intent.ACTION_VIEW)
                                        downloads.setDataAndType(
                                            Uri.parse(
                                                "content://com.android.externalstorage.documents/root/primary"
                                            ),
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

    /**
     * Prefer FileProvider for paths under this app's storage so file managers get a
     * grantable content URI (legacy document/tree URIs often fail for Android/data/...).
     */
    private fun tryOpenFolderWithFileProvider(path: String): Boolean {
        val file = File(path)
        if (!file.exists()) {
            return false
        }
        val dir = if (file.isDirectory) file else file.parentFile ?: return false

        val underExternal = applicationContext.getExternalFilesDir(null)?.canonicalFile
        val underInternal = applicationContext.filesDir.canonicalFile
        val canonicalDir = try {
            dir.canonicalFile
        } catch (_: Exception) {
            return false
        }

        val allowedRoot = when {
            underExternal != null &&
                canonicalDir.absolutePath.startsWith(underExternal.absolutePath) -> true
            canonicalDir.absolutePath.startsWith(underInternal.absolutePath) -> true
            else -> false
        }
        if (!allowedRoot) {
            return false
        }

        return try {
            val uri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                canonicalDir
            )
            val folderIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "resource/folder")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            when {
                folderIntent.resolveActivity(packageManager) != null -> {
                    startActivity(folderIntent)
                    true
                }
                else -> {
                    val generic = Intent(Intent.ACTION_VIEW).apply {
                        data = uri
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    if (generic.resolveActivity(packageManager) != null) {
                        startActivity(generic)
                        true
                    } else {
                        false
                    }
                }
            }
        } catch (_: Exception) {
            false
        }
    }
}
