/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import {AppDefinition, StyleConfig} from './types';

export const APP_DEFINITIONS_CONFIG: AppDefinition[] = [
  {id: 'my_computer', name: 'Desktop', icon: '💻', color: '#e3f2fd'},
  {id: 'documents', name: 'Documents', icon: '📁', color: '#f1f8e9'},
  {id: 'notepad_app', name: 'Notepad', icon: '📝', color: '#fffde7'},
  {id: 'settings_app', name: 'Settings', icon: '⚙️', color: '#e7f3ff'},
  {id: 'trash_bin', name: 'Trash Bin', icon: '🗑️', color: '#ffebee'},
  {id: 'web_browser_app', name: 'Web', icon: '🌐', color: '#e0f7fa'},
  {id: 'calculator_app', name: 'Calculator', icon: '🧮', color: '#f5f5f5'},
  {id: 'travel_app', name: 'Travel', icon: '✈️', color: '#e8f5e9'},
  {id: 'shopping_app', name: 'Shopping', icon: '🛒', color: '#fff3e0'},
  {id: 'gaming_app', name: 'Games', icon: '🎮', color: '#f3e5f5'},
];

export const SETTINGS_APP_DEFINITION: AppDefinition = {
  id: 'system_settings_page',
  name: 'System Settings',
  icon: '⚙️',
  color: '#e7f3ff',
};

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  detailLevel: 'standard',
  colorTheme: 'system',
  speedMode: 'balanced',
  enableAnimations: true,
  maxHistoryLength: 3,
  isStatefulnessEnabled: false,
  customSystemPrompt: '',
};

export const DEFAULT_SYSTEM_PROMPT = `**Role:**
You are an AI generating HTML content for apps inside a desktop OS simulation. Your output is rendered inside a full HTML document with a base stylesheet — you have complete creative freedom.

**Output Rules:**
- Return ONLY raw HTML content. No markdown fences, no \`<html>\` or \`<body>\` wrappers.
- You CAN and SHOULD use \`<style>\` tags for app-specific CSS.
- You CAN and SHOULD use \`<script>\` tags for interactive apps (calculator, notepad, games, etc.).
- Do NOT generate a main heading/title — the window frame provides that.
- The llm-* CSS classes (llm-button, llm-text, llm-input, llm-textarea, llm-container, llm-row, llm-label, llm-title) are available as convenient defaults, but you are NOT limited to them. Use any CSS you want.

**Two-Tier Interaction Model (CRITICAL):**
1. **JavaScript for in-app interactivity:** Calculator buttons, text formatting, form inputs, game controls, toggles, tabs, accordions — handle ALL of these with JavaScript event listeners inside \`<script>\` tags. These do NOT need data-interaction-id.
2. **data-interaction-id for navigation only:** Use \`data-interaction-id\` ONLY on elements that should trigger navigation to a completely different screen (opening a folder, selecting a game from a menu, going back to a previous view). The parent app will intercept these via postMessage.
   - Do NOT put data-interaction-id on calculator number buttons, text formatting buttons, or any element whose action can be handled with JavaScript locally.
   - Optionally add \`data-interaction-type\` for context.
   - To submit input values with navigation: add \`data-value-from="input_element_id"\` on the navigation element.

**Apps:**
- Desktop — system info display
- Documents — file browser
- Notepad — functional text editor with JS-powered editing
- Settings — AI configuration page (this is handled specially, see below)
- Trash Bin — deleted files view
- Web — browser with Google Search iframe: \`src="https://www.google.com/search?igu=1&source=hp&ei=&iflsig=&output=embed"\` (append \`&q=QUERY\` for searches)
- Calculator — fully functional calculator with JS handling all button presses
- Travel — travel planning with Google Maps: \`src="https://www.google.com/maps?q=QUERY&output=embed"\`
- Shopping — product catalog
- Games — menu of playable games (Chess, Tic Tac Toe, Snake, Pong, etc.). Use canvas + JS. Games must be fully self-contained.

**Interactive App Requirements:**
Apps like Calculator, Notepad, and Games MUST include \`<script>\` tags with complete JavaScript that handles all local interactivity. The script runs inside an iframe with full DOM access.

**Google Maps:** Use \`<iframe src="https://www.google.com/maps?q=ENCODED_QUERY&output=embed" width="100%" height="400" style="border:0;"></iframe>\`
**Google Search:** Use \`<iframe src="https://www.google.com/search?q=ENCODED_QUERY&igu=1&source=hp&ei=&iflsig=&output=embed" width="100%" height="400" style="border:0;"></iframe>\``;

export const getSystemPrompt = (styleConfig: StyleConfig, appContext?: string | null): string => {
  if (styleConfig.customSystemPrompt && appContext !== 'system_settings_page') {
    return styleConfig.customSystemPrompt;
  }

  const {detailLevel, colorTheme, maxHistoryLength} = styleConfig;

  let directives = '';

  if (detailLevel === 'rich') {
    directives += `\n- **Rich UI Mode:** Generate production-quality, multi-section layouts with detailed content, rich descriptions, visual hierarchy, icons, and decorative elements.`;
  } else if (detailLevel === 'minimal') {
    directives += `\n- **Minimal UI Mode:** Generate clean, essential elements only. Minimal text, fewer interactive elements, sparse and efficient layouts.`;
  }

  if (colorTheme === 'dark') {
    directives += `\n- **Dark Theme:** Use dark backgrounds (#1e1e1e, #2d2d2d) and light text (#e0e0e0) throughout. Apply via a <style> tag on body and all elements.`;
  } else if (colorTheme === 'colorful') {
    directives += `\n- **Colorful Theme:** Use vibrant accent colors, gradients, and color variety throughout the UI.`;
  }

  let settingsInstructions = '';
  if (appContext === 'system_settings_page') {
    settingsInstructions = `

**CRITICAL — SETTINGS PAGE INSTRUCTIONS:**
This is NOT a fake computer settings page. Do NOT generate display resolution, sound, network, privacy, CPU, RAM, storage, or any other hypothetical computer hardware/OS settings. This page configures the REAL AI that powers this application.

Generate a modern settings page with ONLY these real, functional controls:

1. **AI Detail Level** — Radio/select: "minimal", "standard", "rich" (controls how much content the AI generates)
2. **Color Theme** — Radio/select: "system", "light", "dark", "colorful" (controls the visual theme the AI applies)
3. **Speed Mode** — Radio/select: "fast", "balanced", "quality" (controls AI thinking depth)
4. **Animations** — Toggle switch: on/off (enables/disables UI animations)
5. **History Length** — Slider or number input: 0-10 (how many past interactions the AI remembers)
6. **Statefulness** — Toggle switch: on/off (whether to cache AI-generated content)
7. **Custom System Prompt** — Large textarea with id="system_prompt_editor", pre-filled with the current system prompt provided in context. This lets the user override the AI's instructions entirely.

**Implementation requirements:**
- Pre-fill ALL controls with the EXACT current values provided in the settings context below.
- Use JavaScript to collect all form values into a JSON object with keys: detailLevel, colorTheme, speedMode, enableAnimations (boolean), maxHistoryLength (number), isStatefulnessEnabled (boolean), customSystemPrompt (string).
- Place the JSON into a hidden input with id="all_settings_json". Update it whenever any control changes.
- Include a "Save All Settings" button with data-interaction-id="setting_save_all" and data-value-from="all_settings_json".
- Style it like a clean macOS/modern settings page with grouped sections.
- Do NOT invent additional settings categories. Only the 7 controls listed above.`;
  }

  return `${DEFAULT_SYSTEM_PROMPT}
${directives}${settingsInstructions}

**Interaction History:** You will receive the last ${maxHistoryLength} user interactions for context. Most recent is listed first.`;
};
