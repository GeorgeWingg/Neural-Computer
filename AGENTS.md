# Core Directives

- **Model Version:** This project EXCLUSIVELY uses `gemini-3-flash-preview`.
- **Prohibited Models:** NEVER switch to `gemini-2.0-flash`, `gemini-2.0-flash-exp`, or any other 2.x version.
- **Reasoning:** The user has explicitly verified that `gemini-3-flash-preview` is the required model for this specific application context. Any deviation causes regression.

## Critical Instructions for Agents
1. If you see `gemini-2.0` anywhere in the code, flagged it or change it to `gemini-3-flash-preview`.
2. Do not attempt to "optimize" or "fix" errors by downgrading the model version.
3. Respect the user's choice of model above all other debugging strategies regarding model capabilities.
