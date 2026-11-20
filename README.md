# Desktop-Assistant

A Windows desktop companion application built with **Electron**, **React**, and **TypeScript**, bundled with **Vite**, featuring local voice activation and wake-word detection powered by **openWakeWord**.

---

## 🛠️ Tech Stack

- **Electron** (v33): Native desktop shell, frameless transparent windowing, and secure IPC bridge.
- **React** (v18): Component-based UI rendering with custom pixel-art animations.
- **TypeScript**: Strict type-checking across native Electron, services, and React renderer.
- **Vite** (v6): Fast HMR frontend development and optimized production bundling.
- **Python** (3.10–3.13): Lightweight local audio capture and wake-word detection engine.
- **openWakeWord** & **ONNX Runtime**: Embedded real-time wake-word inference without cloud connectivity.
- **sounddevice** & **PortAudio**: Low-latency local microphone audio capture (16 kHz, 16-bit mono).
- **electron-builder**: Windows executable and NSIS installer packaging.

---

## 📁 Project Structure

```text
Desktop-Assistant/
├── assets/
│   ├── reference/                 # Character reference sheets
│   └── sprites/                   # Pixel-art expressions (happy, listening, sleeping, speaking)
├── docs/                          # Documentation
├── electron/
│   ├── native/
│   │   └── WindowTracker.cs       # Lightweight Win32 foreground window tracker (DWM bounds, 0% CPU)
│   ├── services/
│   │   ├── pythonProcess.ts       # Resilient Python subprocess manager (spawn, stdio IPC, auto-restart)
│   │   └── wakeWordService.ts     # Wake-word coordinator, mic persistence, cooldowns & window repositions
│   ├── main.ts                    # Electron main process (lifecycle, IPC handlers, context menu)
│   └── preload.ts                 # Preload script exposing typed contextBridge API
├── models/
│   └── wake_words/
│       ├── README.md              # Custom model specs and Colab training instructions
│       └── mischief_managed.onnx  # Custom wake-word model location (user-trained)
├── python/
│   ├── wake_word_detector.py      # Standalone Python audio capture and openWakeWord inference helper
│   └── test_audio.py              # Audio pipeline and wake-word verification test suite
├── scripts/
│   ├── build-native.mjs           # Native C# WindowTracker compiler via Windows csc.exe
│   ├── dev.mjs                    # Unified dev runner (Vite dev server + Electron)
│   ├── verify-stage2.mjs          # Stage 2 verification runner
│   ├── verify-stage3.mjs          # Stage 3 verification runner
│   └── verify-stage4.mjs          # Stage 4 voice activation & wake-word verification runner
├── src/
│   ├── components/
│   │   ├── Avatar/
│   │   │   ├── AvatarDisplay.tsx       # Pixel-art sprite renderer with crisp pixelated scaling
│   │   │   ├── DialogueBubble.tsx      # Cartoon-style CSS speech bubble
│   │   │   └── ExpressionControls.tsx  # Dev controls for switching between 4 expressions
│   │   ├── Controls/
│   │   │   ├── MicToggle.tsx           # Voice activation toggle with listening pulse indicator
│   │   │   └── WindowControls.tsx      # Floating window controls (minimize, pin, close)
│   │   └── Companion.tsx               # Orchestrating companion view with listening status
│   ├── hooks/
│   │   ├── useAvatarState.ts           # Centralized avatar lifecycle, voice wake, and mic state management
│   │   └── useIdleTimer.ts             # Inactivity timer with interaction & voice-aware resets
│   ├── styles/
│   │   ├── App.css                     # Companion & avatar styling, keyframe animations, listening pulse
│   │   └── index.css                   # Global transparent background resets
│   ├── types/
│   │   ├── avatar.ts                   # Types and configurations for expressions, sprites & voice dialogue
│   │   └── electron.d.ts               # TypeScript ambient declarations for window.desktopAssistant
│   ├── vite-env.d.ts                   # Asset import declarations
│   ├── App.tsx                         # Main companion canvas
│   └── main.tsx                        # React DOM entry point
├── index.html                     # Vite HTML template with Content Security Policy
├── package.json                   # Dependencies, scripts, and build metadata
├── tsconfig.json                  # TypeScript configuration for the React renderer
├── tsconfig.electron.json         # TypeScript configuration for Electron main & preload
├── vite.config.ts                 # Vite configuration with React plugin and relative base
└── README.md
```

---

## 🎙️ Local Voice Activation: "Mischief managed"

Desktop-Assistant supports **100% local, offline voice activation** using the phrase **"Mischief managed"**.

### Privacy & Architecture
- **Zero Cloud Leakage**: Idle microphone audio is processed strictly on-device in RAM. Audio buffers are discarded immediately after feature extraction. No audio is ever uploaded to Gemini or any external server.
- **Single Engine, Dual State**:
  - When **Sleeping** and the mic is enabled: Saying `"Mischief managed"` transitions the companion to **Awake/Listening**, displays `listening.png`, displays dialogue `"I'm listening!"`, and moves the window to the top-right of the active foreground application.
  - When **Awake** and the mic is enabled: Saying `"Mischief managed"` triggers sleep, displays `sleeping.png`, displays `"Zzz..."`, and returns the companion to its unobtrusive bottom-right screen position.
- **No Duplicate Engines**: A single detector manages both wake and sleep triggers.
- **Cooldown**: A 2.5-second activation cooldown prevents repeated or looped triggers.

---

## 🐍 Python & Audio Prerequisites

### 1. Python Environment
- **Supported Python Versions:** **Python 3.10 to 3.13** (64-bit).
- Ensure Python is added to your Windows `PATH`.

### 2. Install Required Python Packages
Run the following in PowerShell or Command Prompt:

```bash
pip install onnxruntime sounddevice tqdm numpy scipy
pip install --no-deps openwakeword
```

> **Note for Python 3.13 on Windows:** `tflite-runtime` does not have pre-built wheels for Python 3.13. Installing `openwakeword` with `--no-deps` along with `onnxruntime` ensures that the native ONNX runtime backend is used directly without dependency errors.

---

## 🧠 Custom Wake-Word Model ("Mischief managed")

The phrase **"Mischief managed"** is a custom phrase and is not part of the standard built-in pre-trained openWakeWord models (such as "alexa" or "hey_jarvis").

### Model Location
The application loads the custom model from:
```text
models/wake_words/mischief_managed.onnx
```

### Model Specifications
- **Input Shape:** `[1, 16, 96]` (`float32`), representing 16 frames of 96-dimensional acoustic feature embeddings computed by openWakeWord's shared audio backbone.
- **Output Shape:** `[1, 1]` (`float32`), outputting confidence probability between `0.0` and `1.0` (detection threshold: `0.5`).

### How to Train and Export the Model
To generate the `mischief_managed.onnx` model using openWakeWord's automated synthetic training pipeline:

1. Open the official [openWakeWord Google Colab Training Notebook](https://colab.research.google.com/github/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb).
2. Set the target phrase:
   ```python
   target_phrase = "Mischief managed"
   model_name = "mischief_managed"
   ```
3. Run the notebook. The pipeline:
   - Uses Piper TTS to generate thousands of diverse synthetic audio clips with varying pitches, speeds, and accents.
   - Mixes in background noise, room impulse responses (RIRs), and negative speech clips.
   - Trains a lightweight binary classification head on top of the openWakeWord feature backbone.
4. Download the resulting `mischief_managed.onnx` file.
5. Place it into `models/wake_words/mischief_managed.onnx` in this repository.

### Behavior When the Model Is Not Yet Installed
- The application will **never** silently substitute an unrelated wake-word model.
- If `mischief_managed.onnx` is missing, the application logs `modelLoaded: false`, clearly reports that the custom model is missing, and keeps manual wake controls active.
- Automated tests and simulated wake triggers (`test:stage4` and `test:python`) function independently to verify the IPC pipeline, cooldowns, window repositions, and avatar state transitions.

---

## 🎛️ Voice Activation Toggle & Persistence

- Click the **Microphone icon** on the companion canvas or expression dock to toggle voice activation ON or OFF.
- **When Enabled:** The mic icon highlights, a subtle cyan pulse indicates active listening, audio capture begins, and the local wake-word engine monitors for "Mischief managed".
- **When Disabled:** Audio capture stops immediately, all microphone hardware resources are released, the Python process is idled or terminated, and the companion responds exclusively to manual interactions (click-to-wake, hotkeys).
- **Persistent Settings:** Your microphone preference is saved to `%APPDATA%/desktop-assistant/voice-settings.json` and automatically restored whenever the application launches.

---

## 🔧 Windows Microphone Troubleshooting

If voice activation fails to start or the microphone cannot be captured:

1. **Check Windows Privacy Settings:**
   - Open **Windows Settings** > **Privacy & security** > **Microphone**.
   - Verify that **Microphone access** is turned **ON**.
   - Verify that **"Let desktop apps access your microphone"** is turned **ON**.
2. **Check Default Recording Device:**
   - Right-click the sound icon in the Windows taskbar > **Sound settings**.
   - Ensure your desired microphone is set as the **Default device** and its input volume is above 50%.
3. **Verify Audio Capture in Python:**
   Run the audio test suite to verify device enumeration and PortAudio connectivity:
   ```bash
   npm run test:python
   ```
4. **Microphone Disconnection / Reconnection:**
   - If a USB microphone is unplugged while listening is active, the service catches the disconnection gracefully without crashing the Electron UI.
   - Re-toggling the microphone button re-enumerates audio devices and restores capture.

---

## 🚀 Development & Scripts

### 1. Install Dependencies
```bash
# Node dependencies
npm install

# Python dependencies
pip install onnxruntime sounddevice tqdm numpy scipy
pip install --no-deps openwakeword
```

### 2. Start Development Mode
Launches Vite dev server with Hot Module Replacement and starts the Electron companion window:
```bash
npm run dev
```

### 3. Build for Production
Compiles the React frontend into `dist/`, builds the native C# WindowTracker, and compiles TypeScript into `dist-electron/`:
```bash
npm run build
```

### 4. Run Built Application
```bash
npm start
```

### 5. Automated Verification Tests
Desktop-Assistant includes a comprehensive test suite covering all functional stages:

```bash
# Stage 4: Local Voice Activation, Wake-Word Pipeline & Lifecycle Integration
npm run test:stage4

# Python Audio Pipeline & Stdio IPC Verification
npm run test:python

# Stage 3: Window Repositioning, State Machine & Expression Dock
npm run test:stage3

# Stage 2: Frameless Window, Transparency & Pixel Art Expressions
npm run test:stage2

# Run all default tests
npm test
```

### 6. Package for Windows
Creates an installer / executable for Windows via `electron-builder`:
```bash
# Package into distribution directory (quick test)
npm run package:dir

# Full Windows NSIS installer
npm run package
```

---

## 🔒 Security & Architecture Highlights

- **Context Isolation**: Enabled (`contextIsolation: true`).
- **Node Integration**: Disabled in renderer (`nodeIntegration: false`).
- **Sandboxed Renderer**: Enabled (`sandbox: true`).
- **Content Security Policy**: Restricts renderer script execution.
- **Secure Preload Bridge**: Renderer interacts only via typed IPC channels on `window.desktopAssistant`.
- **Subprocess Isolation**: Python audio processing runs in a decoupled child process communicating via line-delimited JSON over stdio. A crash or exit of the Python helper does not crash the Electron application.
- **Privacy First**: No microphone data is stored, transmitted over the network, or sent to cloud AI providers.
