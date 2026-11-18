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
│   ├── main.ts                # Electron main process (lifecycle & secure window setup)
│   └── preload.ts             # Preload script exposing typed contextBridge API
├── scripts/
│   └── dev.mjs                # Unified dev runner (Vite dev server + Electron)
├── src/
│   ├── components/
│   │   ├── StatusCard.tsx     # Placeholder companion status card
│   │   └── TitleBar.tsx       # Custom frameless titlebar with window controls
│   ├── styles/
│   │   ├── App.css            # Component and frame styling
│   │   └── index.css          # Global resets and CSS variables
│   ├── types/
│   │   └── electron.d.ts      # TypeScript ambient declarations for window.desktopAssistant
│   ├── App.tsx                # Main application container
│   └── main.tsx               # React DOM entry point
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

### 5. Package for Windows
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
  - Compact size (350 × 400 px).
  - Always-on-top is configurable in `electron/main.ts` (defaults to `false`).