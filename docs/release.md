# Release and Update Infrastructure (macOS first)

This document describes the release-prep pipeline for the Tauri desktop build and updater artifacts.

## Scope

- Target platform for v1: macOS (`arm64` and `x64`).
- Distribution host: GitHub Releases.
- Landing host: GitHub Pages (in the separate landing repo).
- Updater infrastructure is implemented now, but runtime checks remain gated until you turn it on.

## Branching Model

- Feature development continues on your normal branches.
- Release-prep work lives on `release/prep-tauri`.
- Landing release wiring lives on `release/prep-landing` in `/Users/juno/workspace/neural-os-landing`.

## Prerequisites

1. Install project dependencies:
   - `npm ci`
2. Install Rust toolchain:
   - `rustup toolchain install stable`

## Local Build Commands

1. Web + sidecar build:
   - `npm run build:desktop`
2. Tauri debug desktop app only:
   - `npm run tauri:build -- --debug --bundles app`
3. Local updater manifest generation from release artifacts:
   - `npm run updater:manifest:local`
4. Serve local updater endpoint:
   - `npm run updater:serve:local`
5. Run release preflight checks:
   - `npm run release:preflight`
6. Build release app + DMG with automatic Finder-permission fallback:
   - `npm run tauri:build:release`
7. Optional: force Tauri-styled DMG (no fallback) for environments with Finder scripting access:
   - `npm run tauri:build:release:tauri`
8. Optional: force deterministic fallback DMG path directly:
   - `npm run tauri:build:release:fallback`
9. Regenerate desktop icon assets with calibrated macOS inset:
   - `npm run icons:macos`

## Icon Sizing Notes (macOS)

- `src-tauri/icons/icon-source-macos-rounded.png` is treated as the source icon.
- `npm run icons:macos` defaults to:
  - `84%` overall inset (slightly larger than the prior baseline)
  - vector logo re-render from `public/logo-mark.svg` at high raster resolution for cleaner edges
  - slight upward optical offset for the mark
- You can tune icon generation for local experiments with:
  - `MACOS_ICON_INSET_SCALE=<value> npm run icons:macos`
  - `MACOS_MARK_WIDTH=<pixels> npm run icons:macos`
  - `MACOS_MARK_OFFSET_Y=<pixels> npm run icons:macos`

## Sidecar Artifact Policy

- Sidecar outputs are generated during build (`npm run build:desktop`).
- Generated sidecar outputs are not intended to be hand-edited:
  - `src-tauri/sidecar/server.bundle.cjs`
  - `src-tauri/binaries/neural-os-node-aarch64-apple-darwin`
  - `src-tauri/binaries/neural-os-node-x86_64-apple-darwin`

## DMG Packaging Mode

- `npm run tauri:build:release` uses `scripts/build-release.mjs` in `auto` mode:
  - first attempts `tauri build --bundles app,dmg`;
  - if Finder Apple Events are denied (`-1743`), it falls back to deterministic DMG packaging via `scripts/build-dmg-fallback.mjs` and `hdiutil`.
- Fallback DMG outputs are written to:
  - `src-tauri/target/release/bundle/dmg/`

## Updater Gating

Updater checks are disabled by default until your release channel is ready.

- Frontend gate: `VITE_UPDATER_ENABLED`
- Runtime gate: `TAURI_UPDATER_ENABLED`

Recommended default for feature development:

- `VITE_UPDATER_ENABLED=false`
- `TAURI_UPDATER_ENABLED=false`

## Required GitHub Secrets (for signed + notarized releases)

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- `TAURI_UPDATER_ENDPOINT`
- `TAURI_UPDATER_PUBKEY`

Notes:
- `TAURI_SIGNING_PRIVATE_KEY` is used to sign updater artifacts.
- Apple credentials are used for code signing and notarization.

## Release Trigger

- GitHub workflow: `.github/workflows/release-macos.yml`
- Triggered by tags matching `v*` (for example `v0.2.0`).
- Also supports manual dispatch.
- Release config enforces `npm run build:desktop && npm run release:preflight` before bundling.

## Activation Checklist (when ready to go live)

1. Populate updater release secrets (`TAURI_UPDATER_ENDPOINT`, `TAURI_UPDATER_PUBKEY`) in GitHub.
2. Point updater endpoint at your production release manifest endpoint.
3. Set updater env gates to true for production builds.
4. Push the release tag and verify published artifacts.
5. Update landing download resolver mapping to the tagged release assets.

## Readiness Report

- Current operational readiness snapshot is tracked in:
  - `docs/release-readiness.md`
