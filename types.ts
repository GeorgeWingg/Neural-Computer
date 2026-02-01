/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface InteractionData {
  id: string;
  type: string;
  value?: string;
  elementType: string;
  elementText: string;
  appContext: string | null;
}

export type UIDetailLevel = 'minimal' | 'standard' | 'rich';
export type ColorTheme = 'system' | 'light' | 'dark' | 'colorful';
export type SpeedMode = 'fast' | 'balanced' | 'quality';

export interface StyleConfig {
  detailLevel: UIDetailLevel;
  colorTheme: ColorTheme;
  speedMode: SpeedMode;
  enableAnimations: boolean;
  maxHistoryLength: number;
  isStatefulnessEnabled: boolean;
  customSystemPrompt: string;
}
