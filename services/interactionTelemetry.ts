/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import { EpisodeRating, EpisodeRecord } from '../types';

const EPISODE_STORAGE_KEY = 'neural-os-episodes-v1';
const LEGACY_EPISODE_STORAGE_KEYS = ['neural-computer-episodes-v1', 'gemini-os-episodes-v1'];

function readEpisodeStorageRaw(): string | null {
  const current = localStorage.getItem(EPISODE_STORAGE_KEY);
  if (current) return current;
  for (const legacyKey of LEGACY_EPISODE_STORAGE_KEYS) {
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) continue;
    localStorage.setItem(EPISODE_STORAGE_KEY, legacy);
    LEGACY_EPISODE_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    return legacy;
  }
  return null;
}

export function listEpisodes(): EpisodeRecord[] {
  try {
    const raw = readEpisodeStorageRaw();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as EpisodeRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveEpisode(episode: EpisodeRecord) {
  const episodes = listEpisodes();
  episodes.push(episode);
  localStorage.setItem(EPISODE_STORAGE_KEY, JSON.stringify(episodes.slice(-400)));
}

export function updateEpisodeFeedback(episodeId: string, rating: EpisodeRating, reasons: string[]) {
  const episodes = listEpisodes();
  const index = episodes.findIndex((episode) => episode.id === episodeId);
  if (index < 0) return;
  episodes[index] = {
    ...episodes[index],
    userRating: rating,
    userRatingReasons: [...reasons],
  };
  localStorage.setItem(EPISODE_STORAGE_KEY, JSON.stringify(episodes.slice(-400)));
}
