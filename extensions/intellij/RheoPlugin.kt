// RheoSaver.kt — IntelliJ-platform plugin (Kotlin), platform-bundled Gson only.
// Hooks: FileDocumentManagerListener.beforeDocumentSaving (user saves + autosave;
// dedupe makes autosave safe) and BulkFileListener for VFileDeleteEvent.
// All hashing/appending happens on a single background thread (never EDT I/O).

package com.rheo.changes

import com.google.gson.Gson
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.fileEditor.FileDocumentManagerListener
import com.intellij.openapi.vfs.BulkFileListener
import com.intellij.openapi.vfs.VFileDeleteEvent
import com.intellij.openapi.vfs.VirtualFile
import java.io.BufferedWriter
import java.io.File
import java.io.FileWriter
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

class RheoSaver : FileDocumentManagerListener {
    override fun beforeDocumentSaving(document: com.intellij.openapi.editor.Document) {
        val text = document.text
        IngestQueue.submit(document) { doc ->
            val path = IngestQueue.pathOf(doc) ?: return@submit
            val sha = sha1(text)
            if (IngestQueue.seen(path, sha)) return@submit
            IngestQueue.append(json(
                "v" to 1, "type" to "save", "source" to "intellij",
                "projectPath" to (IngestQueue.projectRootOf(path) ?: return@submit),
                "filePath" to path, "contentSha1" to sha,
                "totalLines" to (text.count { it == '\n' } + if (text.isNotEmpty() && !text.endsWith("\n")) 1 else 0),
                "bytes" to text.toByteArray(Charsets.UTF_8).size
            ))
        }
    }
}

class RheoFiles : BulkFileListener {
    override fun after(events: java.util.List<com.intellij.openapi.vfs.VirtualFileEvent>) {
        for (e in events) {
            if (e is VFileDeleteEvent) {
                val vf = e.file
                val root = IngestQueue.projectRootOf(vf.path) ?: continue
                IngestQueue.append(json("v" to 1, "type" to "delete", "source" to "intellij",
                    "projectPath" to root, "filePath" to vf.path))
            }
        }
    }
}

object IngestQueue {
    private val dedupe = ConcurrentHashMap<String, String>()
    private val exec = Executors.newSingleThreadExecutor()
    private val gson = Gson()
    private val writer: BufferedWriter by lazy {
        val f = ingestFile()
        f.parentFile?.mkdirs()
        BufferedWriter(FileWriter(f, true))
    }
    private val seq = AtomicLong(0)

    fun ingestFile(): File {
        val override = System.getenv("RHEO_INGEST_FILE")
        if (override != null) return File(override)
        val home = System.getProperty("user.home")
        val os = System.getProperty("os.name").lowercase()
        return when {
            os.contains("win") -> File(System.getenv("APPDATA") ?: "", "RHEO/changes.jsonl")
            os.contains("mac") -> File(home, "Library/Application Support/RHEO/changes.jsonl")
            else -> File(home, ".config/RHEO/changes.jsonl")
        }
    }

    fun pathOf(document: com.intellij.openapi.editor.Document): String? = null // resolve via FileDocumentManager
    fun projectRootOf(path: String): String? = null // walk VFS to containing Project.basePath
    fun seen(path: String, sha: String): Boolean = dedupe.put(path, sha) == sha

    fun submit(document: com.intellij.openapi.editor.Document, block: (com.intellij.openapi.editor.Document) -> Unit) {
        exec.submit { block(document) }
    }

    fun append(obj: Map<String, Any>) {
        exec.submit {
            synchronized(writer) {
                writer.write(gson.toJson(obj))
                writer.write("\n")
                writer.flush()
            }
        }
    }

    private fun json(vararg pairs: Pair<String, Any>): Map<String, Any> = linkedMapOf(*pairs)
    private fun sha1(text: String): String {
        val md = MessageDigest.getInstance("SHA-1")
        return md.digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }
}
EOF
echo "written"