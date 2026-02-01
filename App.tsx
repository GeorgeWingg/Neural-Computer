/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import React, { useCallback, useEffect, useState } from 'react';
import { GeneratedContent } from './components/GeneratedContent';
import { Icon } from './components/Icon';
import { Window } from './components/Window';
import { APP_DEFINITIONS_CONFIG, DEFAULT_STYLE_CONFIG, SETTINGS_APP_DEFINITION } from './constants';
import { streamAppContent } from './services/geminiService';
import { AppDefinition, InteractionData, StyleConfig } from './types';

const DesktopView: React.FC<{ onAppOpen: (app: AppDefinition) => void }> = ({
  onAppOpen,
}) => (
  <div className="flex flex-wrap content-start p-4">
    {APP_DEFINITIONS_CONFIG.map((app) => (
      <Icon key={app.id} app={app} onInteract={() => onAppOpen(app)} />
    ))}
  </div>
);

const App: React.FC = () => {
  const [activeApp, setActiveApp] = useState<AppDefinition | null>(null);
  const [llmContent, setLlmContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<
    InteractionData[]
  >([]);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>(() => {
    try {
      const stored = localStorage.getItem('gemini-os-settings');
      if (stored) {
        return { ...DEFAULT_STYLE_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // Ignore parse errors, use defaults
    }
    return DEFAULT_STYLE_CONFIG;
  });

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('gemini-os-settings', JSON.stringify(styleConfig));
  }, [styleConfig]);

  // Statefulness feature state
  const [appContentCache, setAppContentCache] = useState<
    Record<string, string>
  >({});
  const [currentAppPath, setCurrentAppPath] = useState<string[]>([]);

  const getCacheKey = useCallback((path: string[]): string => {
    const basePath = path.join('__');
    return `${basePath}::${styleConfig.detailLevel}::${styleConfig.colorTheme}`;
  }, [styleConfig.detailLevel, styleConfig.colorTheme]);

  const handleStyleConfigChange = useCallback((updates: Partial<StyleConfig>) => {
    setStyleConfig((prev) => {
      const next = { ...prev, ...updates };
      // If statefulness is being disabled, clear cache
      if (updates.isStatefulnessEnabled === false) {
        setAppContentCache({});
      }
      // If style-affecting properties changed, invalidate cache
      if (
        updates.detailLevel !== undefined ||
        updates.colorTheme !== undefined
      ) {
        setAppContentCache({});
      }
      return next;
    });
  }, []);

  const internalHandleLlmRequest = useCallback(
    async (historyForLlm: InteractionData[], config: StyleConfig) => {
      if (historyForLlm.length === 0) {
        setError('No interaction data to process.');
        return;
      }

      setIsLoading(true);
      setError(null);

      let accumulatedContent = '';

      try {
        const stream = streamAppContent(historyForLlm, config);
        for await (const chunk of stream) {
          accumulatedContent += chunk;
          setLlmContent((prev) => prev + chunk);
        }
      } catch (e: any) {
        setError('Failed to stream content from the API.');
        console.error(e);
        accumulatedContent = `<div class="p-4 text-red-600 bg-red-100 rounded-md">Error loading content.</div>`;
        setLlmContent(accumulatedContent);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Effect to cache content when loading finishes and statefulness is enabled
  useEffect(() => {
    if (
      !isLoading &&
      currentAppPath.length > 0 &&
      styleConfig.isStatefulnessEnabled &&
      llmContent
    ) {
      const cacheKey = getCacheKey(currentAppPath);
      if (appContentCache[cacheKey] !== llmContent) {
        setAppContentCache((prevCache) => ({
          ...prevCache,
          [cacheKey]: llmContent,
        }));
      }
    }
  }, [
    llmContent,
    isLoading,
    currentAppPath,
    styleConfig.isStatefulnessEnabled,
    appContentCache,
    getCacheKey,
  ]);

  const handleInteraction = useCallback(
    async (interactionData: InteractionData) => {
      if (interactionData.id === 'app_close_button') {
        handleCloseAppView();
        return;
      }

      // Handle settings interactions from the generated settings page
      if (interactionData.id.startsWith('setting_')) {
        const settingId = interactionData.id;

        // Handle save-all: parse JSON with all settings
        if (settingId === 'setting_save_all') {
          if (!interactionData.value) {
            console.warn('[Settings] Save clicked but no value received — the AI-generated form may not have populated the hidden input correctly.');
            setError('Settings could not be saved — the form data was empty. Try reopening Settings.');
            return;
          }
          try {
            const parsed = JSON.parse(interactionData.value);
            const updates: Partial<StyleConfig> = {};
            if (parsed.detailLevel) updates.detailLevel = parsed.detailLevel;
            if (parsed.colorTheme) updates.colorTheme = parsed.colorTheme;
            if (parsed.speedMode) updates.speedMode = parsed.speedMode;
            if (parsed.enableAnimations !== undefined) updates.enableAnimations = parsed.enableAnimations;
            if (parsed.maxHistoryLength !== undefined) updates.maxHistoryLength = Number(parsed.maxHistoryLength);
            if (parsed.isStatefulnessEnabled !== undefined) updates.isStatefulnessEnabled = parsed.isStatefulnessEnabled;
            if (parsed.customSystemPrompt !== undefined) updates.customSystemPrompt = parsed.customSystemPrompt;
            handleStyleConfigChange(updates);
            console.log('[Settings] Saved:', updates);
          } catch (e) {
            console.error('[Settings] Failed to parse settings JSON:', interactionData.value, e);
            setError('Settings could not be saved — invalid data format. Try reopening Settings.');
          }
          return;
        }

        // Handle individual system prompt save
        if (settingId === 'setting_system_prompt' && interactionData.value !== undefined) {
          handleStyleConfigChange({ customSystemPrompt: interactionData.value });
          return;
        }

        if (settingId === 'setting_detail_minimal') {
          handleStyleConfigChange({ detailLevel: 'minimal' });
        } else if (settingId === 'setting_detail_standard') {
          handleStyleConfigChange({ detailLevel: 'standard' });
        } else if (settingId === 'setting_detail_rich') {
          handleStyleConfigChange({ detailLevel: 'rich' });
        } else if (settingId === 'setting_theme_system') {
          handleStyleConfigChange({ colorTheme: 'system' });
        } else if (settingId === 'setting_theme_light') {
          handleStyleConfigChange({ colorTheme: 'light' });
        } else if (settingId === 'setting_theme_dark') {
          handleStyleConfigChange({ colorTheme: 'dark' });
        } else if (settingId === 'setting_theme_colorful') {
          handleStyleConfigChange({ colorTheme: 'colorful' });
        } else if (settingId === 'setting_speed_fast') {
          handleStyleConfigChange({ speedMode: 'fast' });
        } else if (settingId === 'setting_speed_balanced') {
          handleStyleConfigChange({ speedMode: 'balanced' });
        } else if (settingId === 'setting_speed_quality') {
          handleStyleConfigChange({ speedMode: 'quality' });
        } else if (settingId === 'setting_animations_toggle') {
          handleStyleConfigChange({ enableAnimations: !styleConfig.enableAnimations });
        } else if (settingId === 'setting_statefulness_toggle') {
          handleStyleConfigChange({ isStatefulnessEnabled: !styleConfig.isStatefulnessEnabled });
        } else if (settingId.startsWith('setting_history_')) {
          const val = parseInt(settingId.replace('setting_history_', ''), 10);
          if (!isNaN(val) && val >= 0 && val <= 10) {
            handleStyleConfigChange({ maxHistoryLength: val });
          }
        }
        return;
      }

      const newHistory = [
        interactionData,
        ...interactionHistory.slice(0, styleConfig.maxHistoryLength - 1),
      ];
      setInteractionHistory(newHistory);

      const newPath = activeApp
        ? [...currentAppPath, interactionData.id]
        : [interactionData.id];
      setCurrentAppPath(newPath);
      const cacheKey = getCacheKey(newPath);

      setLlmContent('');
      setError(null);

      if (styleConfig.isStatefulnessEnabled && appContentCache[cacheKey]) {
        setLlmContent(appContentCache[cacheKey]);
        setIsLoading(false);
      } else {
        internalHandleLlmRequest(newHistory, styleConfig);
      }
    },
    [
      interactionHistory,
      internalHandleLlmRequest,
      activeApp,
      styleConfig,
      currentAppPath,
      appContentCache,
      getCacheKey,
      handleStyleConfigChange,
    ],
  );

  const handleAppOpen = (app: AppDefinition) => {
    const initialInteraction: InteractionData = {
      id: app.id,
      type: 'app_open',
      elementText: app.name,
      elementType: 'icon',
      appContext: app.id,
    };

    const newHistory = [initialInteraction];
    setInteractionHistory(newHistory);

    const appPath = [app.id];
    setCurrentAppPath(appPath);
    const cacheKey = getCacheKey(appPath);

    setActiveApp(app);
    setLlmContent('');
    setError(null);

    if (styleConfig.isStatefulnessEnabled && appContentCache[cacheKey]) {
      setLlmContent(appContentCache[cacheKey]);
      setIsLoading(false);
    } else {
      internalHandleLlmRequest(newHistory, styleConfig);
    }
  };

  const handleOpenSettings = () => {
    const settingsApp = SETTINGS_APP_DEFINITION;
    const initialInteraction: InteractionData = {
      id: settingsApp.id,
      type: 'app_open',
      elementText: settingsApp.name,
      elementType: 'icon',
      appContext: settingsApp.id,
    };

    const newHistory = [initialInteraction];
    setInteractionHistory(newHistory);

    const appPath = [settingsApp.id];
    setCurrentAppPath(appPath);

    setActiveApp(settingsApp);
    setLlmContent('');
    setError(null);

    internalHandleLlmRequest(newHistory, styleConfig);
  };

  const handleCloseAppView = () => {
    setActiveApp(null);
    setLlmContent('');
    setError(null);
    setInteractionHistory([]);
    setCurrentAppPath([]);
  };

  // Pre-generation on mount: background-generate top 3 apps when statefulness is enabled
  useEffect(() => {
    if (styleConfig.isStatefulnessEnabled) {
      const top3 = APP_DEFINITIONS_CONFIG.slice(0, 3);
      const fastConfig: StyleConfig = { ...styleConfig, speedMode: 'fast' };
      top3.forEach((app) => {
        const cacheKey = getCacheKey([app.id]);
        if (!appContentCache[cacheKey]) {
          const interaction: InteractionData = {
            id: app.id,
            type: 'app_open',
            elementText: app.name,
            elementType: 'icon',
            appContext: app.id,
          };
          (async () => {
            let content = '';
            try {
              const stream = streamAppContent([interaction], fastConfig);
              for await (const chunk of stream) {
                content += chunk;
              }
              if (content) {
                setAppContentCache((prev) => ({ ...prev, [cacheKey]: content }));
              }
            } catch {
              // Silent fail for background pre-generation
            }
          })();
        }
      });
    }
    // Only run on mount or when statefulness is toggled on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleConfig.isStatefulnessEnabled]);

  // Derive app icon from APP_DEFINITIONS_CONFIG or SETTINGS_APP_DEFINITION
  const activeAppIcon = activeApp
    ? [...APP_DEFINITIONS_CONFIG, SETTINGS_APP_DEFINITION].find(a => a.id === activeApp.id)?.icon
    : undefined;

  const windowTitle = activeApp ? activeApp.name : 'Gemini Computer';
  const contentBgColor = '#ffffff';

  const handleMasterClose = () => {
    if (activeApp) {
      handleCloseAppView();
    }
  };

  return (
    <div className="bg-white w-full min-h-screen flex items-center justify-center p-4">
      <Window
        title={windowTitle}
        onClose={handleMasterClose}
        isAppOpen={!!activeApp}
        appId={activeApp?.id}
        styleConfig={styleConfig}
        onStyleConfigChange={handleStyleConfigChange}
        onOpenSettings={handleOpenSettings}
        onExitToDesktop={handleCloseAppView}>
        <div
          className="w-full h-full"
          style={{ backgroundColor: contentBgColor }}>
          {!activeApp ? (
            <DesktopView onAppOpen={handleAppOpen} />
          ) : (
            <>
              {error && (
                <div className="p-4 text-red-600 bg-red-100 rounded-md">
                  {error}
                </div>
              )}
              <GeneratedContent
                htmlContent={llmContent}
                onInteract={handleInteraction}
                appContext={activeApp.id}
                isLoading={isLoading}
                appName={activeApp.name}
                appIcon={activeAppIcon}
                colorTheme={styleConfig.colorTheme}
              />
            </>
          )}
        </div>
      </Window>
    </div>
  );
};

export default App;
