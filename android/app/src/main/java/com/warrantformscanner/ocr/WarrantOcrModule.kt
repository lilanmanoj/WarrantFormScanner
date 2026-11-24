package com.warrantformscanner.ocr

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.Executors

class WarrantOcrModule(reactContext: ReactApplicationContext) : NativeWarrantOcrSpec(reactContext) {
  private val executor = Executors.newSingleThreadExecutor()

  override fun getName() = NAME

  override fun recognize(
    path: String,
    left: Double,
    top: Double,
    width: Double,
    height: Double,
    scale: Double,
    enhance: Boolean,
    promise: Promise,
  ) {
    executor.execute {
      try {
        val image = WarrantOcr.loadUpright(path.removePrefix("file://"))
        try {
          promise.resolve(WarrantOcr.recognize(image, left, top, width, height, scale, enhance).toString())
        } finally {
          image.recycle()
        }
      } catch (e: Throwable) {
        promise.reject("OCR_ERROR", e.message ?: e.toString(), e)
      }
    }
  }

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "WarrantOcr"
  }
}
