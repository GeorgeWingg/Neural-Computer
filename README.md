# Neural OS

Neural OS is an AI-native desktop environment built with React + Tauri. The UI
is rendered by model output, with runtime guardrails, tool mediation, and
iteration loops for quality.

## Status

Early access quality. Stable enough for controlled usage, still evolving in
runtime, release automation, and developer ergonomics.

## Core Architecture

- **Desktop shell:** Tauri app (`src-tauri/`)
- **Frontend:** React/Vite host UI (`App.tsx`, `components/`)
- **Runtime API:** local Node server (`server.mjs`)
- **Skills + tools:** runtime-mediated file/tool workflows
- **Telemetry + improvement loops:** local episodes/generation feedback

See:
- `ARCHITECTURE.md`
- `docs/self-improvement-system.md`
- `docs/release.md`

## Getting Started

### Prerequisites

- Node.js 20+
- Rust stable toolchain

### Install

```bash
npm ci
```

### Run web + runtime locally

```bash
npm run dev
```

### Run desktop app (Tauri dev)

```bash
npm run tauri:dev
```

## Build and Release Commands

- Build web app: `npm run build`
- Build desktop payload (web + sidecar prep): `npm run build:desktop`
- Build Tauri app (default config): `npm run tauri:build`
- Build release artifacts (release config): `npm run tauri:build:release`
- Generate local updater manifest: `npm run updater:manifest:local`
- Serve local updater endpoint: `npm run updater:serve:local`

## Release Branch Model

- `main`: product development
- `release/prep-tauri`: packaging, updater, and release infrastructure

## Open Source and Contribution

Please read:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

License: Apache-2.0 (`LICENSE`)

## Project Naming Notes

The project is branded as **Neural OS**.

Some internal compatibility keys and legacy identifiers still reference older
`gemini-os` names to preserve migration behavior for existing local state.
