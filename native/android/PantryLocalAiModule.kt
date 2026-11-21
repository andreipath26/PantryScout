package com.andreipath26.pantryscout

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import java.io.File
import java.util.concurrent.Executors

class PantryLocalAiModule(private val appContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(appContext) {

  private val executor = Executors.newSingleThreadExecutor()
  private val modelFile = File(appContext.filesDir, "models/pantry-scout-qwen3-0.6b.litertlm")
  @Volatile private var engine: Engine? = null

  override fun getName() = "PantryLocalAI"

  @ReactMethod
  fun getStatus(promise: Promise) {
    executor.execute {
      try {
        ensureModelCopied()
        promise.resolve(if (modelFile.isFile && modelFile.length() > MIN_MODEL_BYTES) "ready" else "missing")
      } catch (error: Exception) {
        promise.reject("MODEL_COPY_FAILED", "The built-in PantryScout model could not be installed.", error)
      }
    }
  }

  @ReactMethod
  fun generate(prompt: String, promise: Promise) {
    executor.execute {
      try {
        ensureModelCopied()
        val loaded = synchronized(this) {
          engine ?: Engine(EngineConfig(modelPath = modelFile.absolutePath, backend = Backend.CPU())).also {
            it.initialize()
            engine = it
          }
        }
        val answer = loaded.createConversation().use { conversation ->
          conversation.sendMessage(prompt).toString()
        }
        promise.resolve(answer)
      } catch (error: Exception) {
        promise.reject("INFERENCE_FAILED", "PantryScout's on-device AI could not process this request.", error)
      }
    }
  }

  private fun ensureModelCopied() {
    if (modelFile.isFile && modelFile.length() > MIN_MODEL_BYTES) return
    val parent = modelFile.parentFile ?: throw IllegalStateException("Private model storage is unavailable")
    if (!parent.exists() && !parent.mkdirs()) throw IllegalStateException("Could not create private model storage")
    val stagingFile = File(parent, "model-copy.tmp")
    appContext.assets.open(MODEL_ASSET).use { input ->
      stagingFile.outputStream().buffered().use { output -> input.copyTo(output) }
    }
    if (stagingFile.length() != EXPECTED_MODEL_BYTES) {
      stagingFile.delete()
      throw IllegalStateException("The model bundled in this build is incomplete")
    }
    if (modelFile.exists() && !modelFile.delete()) throw IllegalStateException("Could not replace the previous model")
    if (!stagingFile.renameTo(modelFile)) throw IllegalStateException("Could not copy the model into private app storage")
  }

  companion object {
    private const val MODEL_ASSET = "pantry-scout-qwen3-0.6b.litertlm"
    private const val MIN_MODEL_BYTES = 300L * 1024L * 1024L
    private const val EXPECTED_MODEL_BYTES = 344_671_744L
  }
}
