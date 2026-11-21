# Bundled model notices

PantryScout's Android APK includes the following on-device language model:

- **Model:** Qwen3 0.6B, LiteRT-LM INT4 mobile export
- **Format:** `.litertlm`
- **Source:** [litert-community/Qwen3-0.6B](https://huggingface.co/litert-community/Qwen3-0.6B)
- **Pinned source revision:** `e6bb3e4a1eb3f663153f0c1c12b735d64be657a7`
- **Pinned artifact size:** `344,671,744` bytes
- **Pinned artifact SHA-256:** `03e7da1eb1108b50dffaa9bb52cc7bcbad2eb0c66ca990267f480c1e545d2856`
- **License:** Apache License 2.0

The CI workflow downloads this pinned revision of the public model artifact, verifies the exact byte count and SHA-256, and embeds it as an uncompressed Android asset. The app copies it into its private files directory on first use and runs inference on the CPU. No model weights or OCR text are sent to a remote AI service.

Qwen3 weights and code are made available under Apache 2.0. See the [Qwen3 model card](https://huggingface.co/Qwen/Qwen3-0.6B) and the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0). The LiteRT-LM Android runtime is provided by Google AI Edge under Apache 2.0.
