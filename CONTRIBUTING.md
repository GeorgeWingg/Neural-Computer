# Contributing to Neural OS

Thanks for your interest in contributing.

## Development Setup

1. Install prerequisites:
- Node.js 20+
- Rust stable (`rustup toolchain install stable`)

2. Install dependencies:
```bash
npm ci
```

3. Start development services:
```bash
npm run dev
```

4. Run the desktop shell in development:
```bash
npm run tauri:dev
```

## Validation

Before opening a PR, run:
```bash
npm run typecheck
npm run test
npm run build
```

## Branching and PRs

- Make focused, single-purpose PRs.
- Include a clear summary of user-visible behavior changes.
- Add or update tests when behavior changes.
- Keep commits descriptive and scoped.

## Release-Prep Work

Release packaging and updater work lives on `release/prep-tauri`.

Key docs:
- `docs/release.md`
- `ARCHITECTURE.md`

## Commit Message Guidance

Use clear, imperative commit messages. Conventional prefixes are encouraged,
for example:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `chore: ...`

## Reporting Bugs

Please use the bug report issue template and include:

- OS and version
- App version/commit
- Reproduction steps
- Expected vs actual behavior
- Logs or screenshots if available
