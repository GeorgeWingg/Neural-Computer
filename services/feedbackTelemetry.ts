/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import { EpisodeRating, FeedbackEvent } from '../types';

const FEEDBACK_STORAGE_KEY = 'neural-os-feedback-events-v1';
const LEGACY_FEEDBACK_STORAGE_KEYS = ['neural-computer-feedback-events-v1', 'gemini-os-feedback-events-v1'];
const MAX_EVENTS = 500;

function readFeedbackStorageRaw(): string | null {
  const current = localStorage.getItem(FEEDBACK_STORAGE_KEY);
  if (current) return current;
  for (const legacyKey of LEGACY_FEEDBACK_STORAGE_KEYS) {
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) continue;
    localStorage.setItem(FEEDBACK_STORAGE_KEY, legacy);
    LEGACY_FEEDBACK_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    return legacy;
  }
  return null;
}

function readEvents(): FeedbackEvent[] {
  try {
    const raw = readFeedbackStorageRaw();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeedbackEvent[]) : [];
  } catch {
    return [];
  }
}

function writeEvents(events: FeedbackEvent[]) {
  localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function listFeedbackEvents(limit?: number): FeedbackEvent[] {
  const events = readEvents().sort((a, b) => b.createdAt - a.createdAt);
  return typeof limit === 'number' ? events.slice(0, limit) : events;
}

interface RecordFeedbackInput {
  episodeId: string;
  generationId?: string;
  appContext: string;
  rating: EpisodeRating;
  reasons: string[];
}

export function recordFeedbackEvent(input: RecordFeedbackInput): FeedbackEvent {
  const event: FeedbackEvent = {
    id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    episodeId: input.episodeId,
    generationId: input.generationId,
    appContext: input.appContext,
    rating: input.rating,
    reasons: [...input.reasons],
  };

  const events = readEvents();
  events.push(event);
  writeEvents(events);
  return event;
}
