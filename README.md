# Desktop-Assistant

A Windows desktop companion application built with **Electron**, **React**, and **TypeScript**, bundled with **Vite**.

---

## 🛠️ Tech Stack

- **Electron** (v33): Native desktop shell, frameless windowing, and secure IPC bridge.
- **React** (v18): Component-based UI rendering.
- **TypeScript**: Strict type-checking across both native (Electron) and renderer (React) processes.
- **Vite** (v6): Fast HMR frontend development and optimized production bundling.
- **CSS**: Custom modular styling with system-aware typography and glassmorphism accents.
- **electron-builder**: Windows executable and installer packaging.

---

## 📁 Project Structure

```text
Desktop-Assistant/
├── assets/
│   ├── reference/             # Character reference sheets
│   └── sprites/               # Pixel-art expressions
├── docs/                      # Documentation
├── electron/
│   ├── native/
│   │   └── WindowTracker.cs       # Lightweight Win32 foreground window tracker (DWM bounds, 0% CPU)
│   ├── main.ts                    # Electron main process (lifecycle, top-right repositioning, context menu)
│   └── preload.ts                 # Preload script exposing typed contextBridge API
├── scripts/
│   ├── build-native.mjs           # Native C# WindowTracker compiler via Windows csc.exe
│   ├── dev.mjs                    # Unified dev runner (Vite dev server + Electron)
│   └── verify-stage2.mjs          # Automated end-to-end verification runner
├── src/
│   ├── components/
│   │   ├── Avatar/
│   │   │   ├── AvatarDisplay.tsx       # Pixel-art sprite renderer with crisp pixelated scaling
│   │   │   ├── DialogueBubble.tsx      # Cartoon-style CSS speech bubble
│   │   │   └── ExpressionControls.tsx  # Dev controls for switching between 4 expressions
│   │   ├── Controls/
│   │   │   ├── MicToggle.tsx           # Voice activation toggle with visual state indicator
│   │   │   └── WindowControls.tsx      # Floating window controls (minimize, pin, close)
│   │   └── Companion.tsx               # Orchestrating companion view
│   ├── hooks/
│   │   ├── useAvatarState.ts           # Centralized avatar lifecycle & state management
│   │   └── useIdleTimer.ts             # Inactivity timer with interaction-aware resets
│   ├── styles/
│   │   ├── App.css                     # Companion & avatar styling, keyframe animations
│   │   └── index.css                   # Global transparent background resets
│   ├── types/
│   │   ├── avatar.ts                   # Types and configurations for expressions & sprites
│   │   └── electron.d.ts               # TypeScript ambient declarations for window.desktopAssistant
│   ├── vite-env.d.ts                   # Asset import declarations
│   ├── App.tsx                         # Main companion canvas
│   └── main.tsx                        # React DOM entry point
├── index.html                 # Vite HTML template with Content Security Policy
├── package.json               # Dependencies, scripts, and build metadata
├── tsconfig.json              # TypeScript configuration for the React renderer
├── tsconfig.electron.json     # TypeScript configuration for Electron main & preload
├── vite.config.ts             # Vite configuration with React plugin and relative base
└── README.md
```

---

## 🚀 Development & Scripts

### Prerequisites
- Node.js (v20+ recommended, tested on v22)
- npm (v10+)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Mode
Starts the Vite dev server and launches the Electron application with Hot Module Replacement (HMR):
```bash
npm run dev
```

### 3. Build for Production
Compiles the React frontend into `dist/` and the Electron scripts into `dist-electron/`:
```bash
npm run build
```

### 4. Run Built Application Locally
Runs Electron against the compiled production assets:
```bash
npm start
```

### 5. Automated Verification
Runs automated end-to-end verification testing the full avatar lifecycle (sleeping on start, unobtrusive bottom-right placement, manual click wake-up with listening sprite & "I'm here! What do you need?", active window tracking, no random expression cycling while awake, inactivity auto-sleep, manual sleep via Ctrl+Shift+S & context menu, microphone independence, and expression dev controls):
```bash
# Run Stage 3 verification (or npm test)
npm run test:stage3

# Stage 2 verification is also preserved
npm run test:stage2
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
- **Sandboxed**: Enabled (`sandbox: true`).
- **Content Security Policy**: Configured in `index.html` to restrict script execution.
- **Secure Preload Bridge**: Renderer communicates exclusively via strictly defined IPC channels using Electron's `contextBridge`.
- **Configurable Window**:
  - Frameless (`frame: false`).
  - Transparent background (`transparent: true`, `backgroundColor: '#00000000'`).
  - Compact size (180 × 210 px; avatar scaled to ~105 × 105 px).
  - Dynamic positioning: Automatically positions 20–25 px from the top-right corner of the active foreground application without stealing keyboard focus.
  - Development tools: Expression dock hidden from normal UI, accessible via `Ctrl+Shift+D`, right-click context menu, or keys `1`-`4`.
  - Always-on-top is configurable in `electron/main.ts` (defaults to `false`).