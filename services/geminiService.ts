/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import {GoogleGenAI} from '@google/genai';
import {APP_DEFINITIONS_CONFIG, DEFAULT_SYSTEM_PROMPT, SETTINGS_APP_DEFINITION, getSystemPrompt} from '../constants';
import {InteractionData, StyleConfig} from '../types';

if (!process.env.API_KEY) {
  console.error(
    'API_KEY environment variable is not set. The application will not be able to connect to the Gemini API.',
  );
}

const ai = new GoogleGenAI({apiKey: process.env.API_KEY!});

export async function* streamAppContent(
  interactionHistory: InteractionData[],
  styleConfig: StyleConfig,
): AsyncGenerator<string, void, void> {
  const model = 'gemini-3-flash-preview';

  if (!process.env.API_KEY) {
    yield `<div class="p-4 text-red-700 bg-red-100 rounded-lg">
      <p class="font-bold text-lg">Configuration Error</p>
      <p class="mt-2">The API_KEY is not configured. Please set the API_KEY environment variable.</p>
    </div>`;
    return;
  }

  if (interactionHistory.length === 0) {
    yield `<div class="p-4 text-orange-700 bg-orange-100 rounded-lg">
      <p class="font-bold text-lg">No interaction data provided.</p>
    </div>`;
    return;
  }

  const currentInteraction = interactionHistory[0];
  const appContext = currentInteraction.appContext;
  const systemPrompt = getSystemPrompt(styleConfig, appContext);

  const pastInteractions = interactionHistory.slice(1);

  const currentElementName =
    currentInteraction.elementText ||
    currentInteraction.id ||
    'Unknown Element';
  let currentInteractionSummary = `Current User Interaction: Clicked on '${currentElementName}' (Type: ${currentInteraction.type || 'N/A'}, ID: ${currentInteraction.id || 'N/A'}).`;
  if (currentInteraction.value) {
    currentInteractionSummary += ` Associated value: '${currentInteraction.value.substring(0, 100)}'.`;
  }

  const allAppDefs = [...APP_DEFINITIONS_CONFIG, SETTINGS_APP_DEFINITION];
  const currentAppDef = allAppDefs.find(
    (app) => app.id === currentInteraction.appContext,
  );
  const currentAppContext = currentInteraction.appContext
    ? `Current App Context: '${currentAppDef?.name || currentInteraction.appContext}'.`
    : 'No specific app context for current interaction.';

  let historyPromptSegment = '';
  if (pastInteractions.length > 0) {
    const numPrevInteractionsToMention =
      styleConfig.maxHistoryLength - 1 > 0 ? styleConfig.maxHistoryLength - 1 : 0;
    historyPromptSegment = `\n\nPrevious User Interactions (up to ${numPrevInteractionsToMention} most recent, oldest first in this list segment but chronologically before current):`;

    pastInteractions.forEach((interaction, index) => {
      const pastElementName =
        interaction.elementText || interaction.id || 'Unknown Element';
      const appDef = allAppDefs.find(
        (app) => app.id === interaction.appContext,
      );
      const appName = interaction.appContext
        ? appDef?.name || interaction.appContext
        : 'N/A';
      historyPromptSegment += `\n${index + 1}. (App: ${appName}) Clicked '${pastElementName}' (Type: ${interaction.type || 'N/A'}, ID: ${interaction.id || 'N/A'})`;
      if (interaction.value) {
        historyPromptSegment += ` with value '${interaction.value.substring(0, 50)}'`;
      }
      historyPromptSegment += '.';
    });
  }

  // For settings page, include current config and default prompt as context
  let settingsContext = '';
  if (appContext === 'system_settings_page') {
    settingsContext = `\n\nCurrent Settings (pre-fill these values in the form):
${JSON.stringify({
  detailLevel: styleConfig.detailLevel,
  colorTheme: styleConfig.colorTheme,
  speedMode: styleConfig.speedMode,
  enableAnimations: styleConfig.enableAnimations,
  maxHistoryLength: styleConfig.maxHistoryLength,
  isStatefulnessEnabled: styleConfig.isStatefulnessEnabled,
}, null, 2)}

Current System Prompt (pre-fill in the textarea):
${styleConfig.customSystemPrompt || DEFAULT_SYSTEM_PROMPT}`;
  }

  const fullPrompt = `${systemPrompt}

${currentInteractionSummary}
${currentAppContext}
${historyPromptSegment}${settingsContext}

Full Context for Current Interaction (for your reference, primarily use summaries and history):
${JSON.stringify(currentInteraction, null, 1)}

Generate the HTML content for the window's content area only:`;

  // Determine thinkingConfig based on speedMode
  let thinkingConfig: Record<string, unknown> | undefined;
  if (styleConfig.speedMode === 'fast') {
    thinkingConfig = {thinkingBudget: 0};
  } else if (styleConfig.speedMode === 'quality') {
    thinkingConfig = {thinkingBudget: 8192};
  }

  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContentStream({
        model: model,
        contents: fullPrompt,
        config: {
          ...(thinkingConfig ? {thinkingConfig} : {}),
        },
      });

      for await (const chunk of response) {
        if (chunk.text) {
          yield chunk.text;
        }
      }
      return; // Success, exit generator
    } catch (error) {
      lastError = error;
      const isRetryable = error instanceof Error &&
        (error.message.includes('503') || error.message.includes('UNAVAILABLE') || error.message.includes('overloaded'));
      if (isRetryable && attempt < 2) {
        console.warn(`Gemini API returned retryable error (attempt ${attempt + 1}/3), retrying in ${(attempt + 1) * 2}s...`, error);
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      break;
    }
  }

  // All retries failed — yield the error HTML
  console.error('Error streaming from Gemini (all retries exhausted):', lastError);
  let errorMessage = 'An error occurred while generating content.';
  if (lastError instanceof Error && typeof lastError.message === 'string') {
    errorMessage += ` Details: ${lastError.message}`;
  } else if (
    typeof lastError === 'object' &&
    lastError !== null &&
    'message' in lastError &&
    typeof (lastError as any).message === 'string'
  ) {
    errorMessage += ` Details: ${(lastError as any).message}`;
  } else if (typeof lastError === 'string') {
    errorMessage += ` Details: ${lastError}`;
  }

  yield `<div class="p-4 text-red-700 bg-red-100 rounded-lg">
    <p class="font-bold text-lg">Error Generating Content</p>
    <p class="mt-2">${errorMessage}</p>
    <p class="mt-1">This may be due to an API key issue, network problem, or misconfiguration. Please check the developer console for more details.</p>
  </div>`;
}
