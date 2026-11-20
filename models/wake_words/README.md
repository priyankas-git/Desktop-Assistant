# Wake-Word Models Directory

This directory stores local wake-word detection models for the desktop companion.

## Target Wake-Word: **"Mischief managed"**

The application is configured to load the custom wake-word model for **"Mischief managed"** from this directory:
- Expected file: `mischief_managed.onnx` (or `mischief_managed.tflite`)
- Target location: `models/wake_words/mischief_managed.onnx`

---

## Model Specifications

- **Engine:** [openWakeWord](https://github.com/dscripka/openWakeWord)
- **Input Tensor:**
  - Name: `onnx::Flatten_0` (or `input`)
  - Shape: `[1, 16, 96]` (float32)
  - Description: 16 time frames of 96-dimensional audio feature embeddings computed by openWakeWord's shared audio backbone from 16 kHz 16-bit mono audio.
- **Output Tensor:**
  - Shape: `[1, 1]` (float32)
  - Description: Confidence probability in the range `[0.0, 1.0]`. Threshold: `0.5`.

---

## How to Train / Generate the "Mischief managed" Model

"Mischief managed" is a custom two-word phrase and is not a built-in standard model in openWakeWord. It must be generated using openWakeWord's synthetic text-to-speech training pipeline:

1. **Open the Official openWakeWord Google Colab Training Notebook:**
   - [openWakeWord Automated Model Training Notebook](https://colab.research.google.com/github/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb)
2. **Configure Wake-Word Parameters:**
   - Set `target_phrase = "Mischief managed"`
   - Set `model_name = "mischief_managed"`
3. **Execute Dataset Generation & Training:**
   - The notebook uses Piper TTS to generate thousands of synthetic clips with various speaker accents, pitches, and speeds.
   - Clips are augmented with background noise, room impulse responses (RIR), and hard-negative speech samples.
   - A lightweight binary classification head is trained on top of the shared 96-dimensional embedding features.
4. **Export ONNX Model:**
   - Download the generated `mischief_managed.onnx` file from the Colab session.
5. **Install into Application:**
   - Copy `mischief_managed.onnx` into this directory:
     ```text
     Desktop-Assistant/models/wake_words/mischief_managed.onnx
     ```
   - When Desktop-Assistant is launched and Voice Activation is toggled ON, it will automatically detect and load `mischief_managed.onnx`.

---

## Status When Model Is Missing

If `mischief_managed.onnx` is not yet placed in this directory:
- The application reports `modelLoaded: false` with a clear status message.
- The application will **never** silently substitute an unrelated wake-word.
- Simulated and automated verification tests continue functioning to validate audio pipeline mechanics, cooldowns, and avatar lifecycle transitions.
