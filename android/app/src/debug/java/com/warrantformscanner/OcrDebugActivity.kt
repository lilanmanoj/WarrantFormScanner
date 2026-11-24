package com.warrantformscanner

import android.app.Activity
import android.os.Bundle
import android.util.Log
import com.warrantformscanner.ocr.WarrantOcr
import org.json.JSONObject
import java.io.File
import kotlin.concurrent.thread

/**
 * Debug-only harness: runs WarrantOcr over every image in <app files>/samples and writes
 * the raw results to <app files>/ocr/<name>.json, for tuning the JS field extraction.
 *
 *   adb push img.jpeg /data/local/tmp/ws/
 *   adb shell run-as com.warrantformscanner sh -c 'mkdir -p files/samples && cp /data/local/tmp/ws/IMAGES files/samples/'
 *   adb shell am start -n com.warrantformscanner/.OcrDebugActivity
 *   adb exec-out run-as com.warrantformscanner cat files/ocr/<name>.json
 */
class OcrDebugActivity : Activity() {
  private data class Config(
    val name: String, val l: Double, val t: Double, val w: Double, val h: Double,
    val scale: Double, val enhance: Boolean,
  )

  private val configs = listOf(
    Config("full", 0.0, 0.0, 1.0, 1.0, 1.0, false),
    Config("full_enh", 0.0, 0.0, 1.0, 1.0, 1.0, true),
    Config("topright_x2", 0.45, 0.0, 0.55, 0.25, 2.0, false),
    Config("bottom_x2", 0.0, 0.6, 1.0, 0.35, 2.0, false),
    Config("bottom_x2_enh", 0.0, 0.6, 1.0, 0.35, 2.0, true),
    Config("bottomright_x3", 0.5, 0.65, 0.5, 0.25, 3.0, false),
  )

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val base = filesDir
    val input = File(base, "samples")
    val output = File(base, "ocr").apply { mkdirs() }
    thread {
      val files = input.listFiles { f -> f.name.matches(Regex("(?i).*\\.(jpe?g|png)")) }?.sorted() ?: emptyList()
      Log.i(TAG, "Processing ${files.size} images from $input")
      for (file in files) {
        val result = JSONObject().put("file", file.name)
        val image = WarrantOcr.loadUpright(file.absolutePath)
        for (c in configs) {
          val start = System.currentTimeMillis()
          val r = WarrantOcr.recognize(image, c.l, c.t, c.w, c.h, c.scale, c.enhance)
          r.put("ms", System.currentTimeMillis() - start)
          result.put(c.name, r)
        }
        image.recycle()
        File(output, file.nameWithoutExtension + ".json").writeText(result.toString(2))
        Log.i(TAG, "Done ${file.name}")
      }
      Log.i(TAG, "OCR_DEBUG_COMPLETE")
      runOnUiThread { finish() }
    }
  }

  companion object {
    private const val TAG = "OcrDebug"
  }
}
