# Bundled model notices

PantryScout's Android APK includes the following on-device language model:

- **Model:** Qwen3 0.6B, LiteRT-LM INT4 mobile export
- **Format:** `.litertlm`
- **Source:** [litert-community/Qwen3-0.6B](https://huggingface.co/litert-community/Qwen3-0.6B)
- **Pinned artifact size:** `344,686,592` bytes
- **Pinned artifact SHA-256:** `96491bb0f78fa68098bf8f1d3628194c97041aff7894f8cc29303b3acdb877a9`
- **License:** Apache License 2.0

The CI workflow downloads the public model artifact, verifies the exact byte count and SHA-256, and embeds it as an uncompressed Android asset. The checksum pins the exact artifact even if the upstream branch changes. The app copies it into its private files directory on first use and runs inference on the CPU. No model weights or OCR text are sent to a remote AI service.

Qwen3 weights and code are made available under Apache 2.0. See the [Qwen3 model card](https://huggingface.co/Qwen/Qwen3-0.6B) and the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0). The LiteRT-LM Android runtime is provided by Google AI Edge under Apache 2.0.
