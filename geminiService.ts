/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {GoogleGenAI} from '@google/genai';
import {APP_DEFINITIONS_CONFIG, DEFAULT_SYSTEM_PROMPT, getSystemPrompt} from '../constants';
import {InteractionData, StyleConfig} from '../types';

if (!process.env.API_KEY) {
  // This is a critical error. In a real app, you might throw or display a persistent error.
  // For this environment, logging to console is okay, but the app might not function.
  console.error(
    'API_KEY environment variable is not set. The application will not be able to connect to the Gemini API.',
  );
}

const ai = new GoogleGenAI({apiKey: process.env.API_KEY!}); // The "!" asserts API_KEY is non-null after the check.

export async function* streamAppContent(
  interactionHistory: InteractionData[],
  styleConfig: StyleConfig,
): AsyncGenerator<string, void, void> {
  const model = 'gemini-3-flash-preview';
  const currentMaxHistoryLength = styleConfig.maxHistoryLength;

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

  const appContext = interactionHistory[0]?.appContext || null;
  const systemPrompt = getSystemPrompt(styleConfig, appContext);

  const currentInteraction = interactionHistory[0];
  // pastInteractions already respects currentMaxHistoryLength due to slicing in App.tsx
  const pastInteractions = interactionHistory.slice(1);

  const currentElementName =
    currentInteraction.elementText ||
    currentInteraction.id ||
    'Unknown Element';
  let currentInteractionSummary = `Current User Interaction: Clicked on '${currentElementName}' (Type: ${currentInteraction.type || 'N/A'}, ID: ${currentInteraction.id || 'N/A'}).`;
  if (currentInteraction.value) {
    currentInteractionSummary += ` Associated value: '${currentInteraction.value.substring(0, 100)}'.`;
  }

  const currentAppDef = APP_DEFINITIONS_CONFIG.find(
    (app) => app.id === currentInteraction.appContext,
  );
  const currentAppContext = currentInteraction.appContext
    ? `Current App Context: '${currentAppDef?.name || currentInteraction.appContext}'.`
    : 'No specific app context for current interaction.';

  let historyPromptSegment = '';
  if (pastInteractions.length > 0) {
    // The number of previous interactions to mention in the prompt text.
    const numPrevInteractionsToMention =
      currentMaxHistoryLength - 1 > 0 ? currentMaxHistoryLength - 1 : 0;
    historyPromptSegment = `\n\nPrevious User Interactions (up to ${numPrevInteractionsToMention} most recent, oldest first in this list segment but chronologically before current):`;

    // Iterate over the pastInteractions array, which is already correctly sized
    pastInteractions.forEach((interaction, index) => {
      const pastElementName =
        interaction.elementText || interaction.id || 'Unknown Element';
      const appDef = APP_DEFINITIONS_CONFIG.find(
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

  let settingsContext = '';
  if (appContext === 'system_settings_page') {
    settingsContext = `

Current Settings (pre-fill these EXACT values in the form controls):
${JSON.stringify({
  detailLevel: styleConfig.detailLevel,
  colorTheme: styleConfig.colorTheme,
  speedMode: styleConfig.speedMode,
  enableAnimations: styleConfig.enableAnimations,
  maxHistoryLength: styleConfig.maxHistoryLength,
  isStatefulnessEnabled: styleConfig.isStatefulnessEnabled,
}, null, 2)}

Current System Prompt (pre-fill in the system_prompt_editor textarea):
${styleConfig.customSystemPrompt || DEFAULT_SYSTEM_PROMPT}`;
  }

  const fullPrompt = `${systemPrompt}

${currentInteractionSummary}
${currentAppContext}
${historyPromptSegment}${settingsContext}

Generate the HTML content for the window's content area only:`;

  try {
    const response = await ai.models.generateContentStream({
      model: model,
      contents: fullPrompt,
      // Removed thinkingConfig to use default (enabled thinking) for higher quality responses
      // as this is a general app, not a low-latency game AI.
      config: {},
    });

    let hasContent = false;
    for await (const chunk of response) {
      if (chunk.text) {
        hasContent = true;
        yield chunk.text;
      }
    }
    if (!hasContent) {
      console.warn('[Gemini] Stream completed with no content.', {appContext, model});
      yield `<div class="p-4 text-amber-700 bg-amber-50 rounded-lg">
        <p class="font-bold text-lg">Empty Response</p>
        <p class="mt-2">The AI returned no content. This can happen if the system prompt is invalid or too restrictive.</p>
        <p class="mt-1">Try resetting your custom system prompt in Settings, or reload the page.</p>
      </div>`;
    }
  } catch (error) {
    console.error('[Gemini] Error streaming:', error);
    let errorMessage = 'An error occurred while generating content.';
    if (error instanceof Error && typeof error.message === 'string') {
      errorMessage += ` ${error.message}`;
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as any).message === 'string'
    ) {
      errorMessage += ` ${(error as any).message}`;
    } else if (typeof error === 'string') {
      errorMessage += ` ${error}`;
    }

    // Provide actionable guidance based on error type
    let hint = 'Check the developer console for more details.';
    if (errorMessage.includes('API_KEY') || errorMessage.includes('401') || errorMessage.includes('403')) {
      hint = 'Your API key may be invalid or expired. Check your .env.local file.';
    } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      hint = 'You may have hit an API rate limit. Wait a moment and try again.';
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
      hint = 'Check your internet connection.';
    } else if (styleConfig.customSystemPrompt) {
      hint = 'You have a custom system prompt set — it may be causing issues. Try resetting it in Settings.';
    }

    yield `<div class="p-4 text-red-700 bg-red-100 rounded-lg">
      <p class="font-bold text-lg">Error Generating Content</p>
      <p class="mt-2">${errorMessage}</p>
      <p class="mt-1">${hint}</p>
    </div>`;
  }
}
