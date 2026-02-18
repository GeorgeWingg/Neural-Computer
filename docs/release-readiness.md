# Neural OS Release Readiness (release/prep-tauri)

Last updated: 2026-02-18
Branch: `release/prep-tauri`

## Summary

This branch now has a working sidecar runtime, graceful runtime recovery UX, deterministic DMG fallback packaging in local restricted environments, runtime-root-aware path resolution, and loopback/CORS hardening.

The remaining ship gate is signed/notarized release verification in CI with production secrets.

## Validation Evidence

1. Sidecar runtime smoke
   - Command: `npm run -s test -- tests/sidecar-bundle.test.ts`
   - Result: pass (`/api/health` served by bundled node + sidecar bundle).

2. Runtime bootstrap + recovery wiring
   - Commands:
     - `npm run -s test -- tests/runtime-bootstrap-service.test.ts`
     - `npm run -s test -- tests/runtime-paths.test.ts`
   - Result: pass.
   - Manual behavior expectation:
     - Tauri exposes `runtime_bootstrap_status` and `runtime_retry_bootstrap`.
     - Frontend blocks onboarding fetch loop when runtime is unavailable and shows recovery UI (`Try again`, `Open settings`, `Technical details`).

3. Full test suite
   - Command: `npm run -s test`
   - Result: pass (`18` test files, `63` tests).

4. Local release packaging (restricted Finder Apple Events environment)
   - Command: `npm run -s tauri:build:release`
   - Result: pass via fallback mode.
   - Produced artifact:
     - `src-tauri/target/release/bundle/dmg/Neural-OS_0.1.0_aarch64.dmg`

5. Release preflight
   - Command: `npm run -s release:preflight`
   - Result: pass (local mode; CI secret validation intentionally skipped outside CI).

## Signing and Notarization Status

- CI workflow is present: `.github/workflows/release-macos.yml`.
- Required secrets are documented in `docs/release.md`.
- Local validation in this report does not include real Apple signing/notarization.
- Ship gate remains: run tagged CI release and confirm signed/notarized artifacts publish successfully.

## Residual Risks

1. CI-only signing and notarization path is not yet empirically verified in this run.
2. Auto fallback DMG uses deterministic `hdiutil` packaging (not Finder-styled layout), which is acceptable for reliability but may differ visually from styled DMGs.
3. Updater enablement remains gated by env (`VITE_UPDATER_ENABLED`, `TAURI_UPDATER_ENABLED`) and should be turned on only after first signed release validation.
