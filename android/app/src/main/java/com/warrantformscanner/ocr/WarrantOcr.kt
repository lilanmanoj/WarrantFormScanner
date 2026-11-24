package com.warrantformscanner.ocr

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import androidx.exifinterface.media.ExifInterface
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * On-device OCR for warrant forms using ML Kit's bundled Latin text model.
 * Runs synchronously – call it from a background thread.
 */
object WarrantOcr {
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  /** Decodes the file and applies its EXIF rotation so the bitmap is upright. */
  fun loadUpright(path: String): Bitmap {
    val bitmap = BitmapFactory.decodeFile(path)
      ?: throw IllegalArgumentException("Cannot decode image: $path")
    val rotation = when (
      ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
    ) {
      ExifInterface.ORIENTATION_ROTATE_90 -> 90f
      ExifInterface.ORIENTATION_ROTATE_180 -> 180f
      ExifInterface.ORIENTATION_ROTATE_270 -> 270f
      else -> 0f
    }
    if (rotation == 0f) return bitmap
    val m = Matrix().apply { postRotate(rotation) }
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m, true).also {
      if (it !== bitmap) bitmap.recycle()
    }
  }

  /** Grayscale + contrast boost: makes faint pen strokes stand out from the printed grid. */
  private fun enhance(src: Bitmap): Bitmap {
    val out = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
    val contrast = 1.6f
    val translate = (1f - contrast) * 128f
    val matrix = ColorMatrix().apply { setSaturation(0f) }
    matrix.postConcat(
      ColorMatrix(
        floatArrayOf(
          contrast, 0f, 0f, 0f, translate,
          0f, contrast, 0f, 0f, translate,
          0f, 0f, contrast, 0f, translate,
          0f, 0f, 0f, 1f, 0f,
        ),
      ),
    )
    Canvas(out).drawBitmap(src, 0f, 0f, Paint().apply { colorFilter = ColorMatrixColorFilter(matrix) })
    return out
  }

  /**
   * Recognises text in [image] (already upright). The region is given as fractions of the
   * image; coordinates in the result are mapped back to [image] pixels.
   */
  fun recognize(
    image: Bitmap,
    left: Double,
    top: Double,
    width: Double,
    height: Double,
    scale: Double,
    enhance: Boolean,
  ): JSONObject {
    val x0 = (left.coerceIn(0.0, 1.0) * image.width).roundToInt()
    val y0 = (top.coerceIn(0.0, 1.0) * image.height).roundToInt()
    val w = max(1, min(image.width - x0, (width * image.width).roundToInt()))
    val h = max(1, min(image.height - y0, (height * image.height).roundToInt()))
    val s = scale.coerceIn(0.25, 4.0)

    var region = if (x0 == 0 && y0 == 0 && w == image.width && h == image.height) {
      image
    } else {
      Bitmap.createBitmap(image, x0, y0, w, h)
    }
    if (s != 1.0) {
      region = Bitmap.createScaledBitmap(region, (w * s).roundToInt(), (h * s).roundToInt(), true)
    }
    if (enhance) {
      region = enhance(region)
    }

    val text = Tasks.await(recognizer.process(InputImage.fromBitmap(region, 0)))

    fun rectJson(r: Rect?): JSONObject? = r?.let {
      JSONObject()
        .put("left", x0 + it.left / s)
        .put("top", y0 + it.top / s)
        .put("width", it.width() / s)
        .put("height", it.height() / s)
    }

    val lines = JSONArray()
    for (block in text.textBlocks) {
      for (line in block.lines) {
        val elements = JSONArray()
        for (el in line.elements) {
          elements.put(JSONObject().put("text", el.text).put("frame", rectJson(el.boundingBox)))
        }
        lines.put(
          JSONObject()
            .put("text", line.text)
            .put("frame", rectJson(line.boundingBox))
            .put("elements", elements),
        )
      }
    }
    return JSONObject()
      .put("width", image.width)
      .put("height", image.height)
      .put("lines", lines)
  }
}
