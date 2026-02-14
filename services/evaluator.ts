/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import { EpisodeRecord } from '../types';

export interface EvaluationReport {
  promote: boolean;
  reason: string;
  sampleSize: number;
  acceptedRate: number;
  avgRegenerateCount: number;
  qualityScore: number;
  qualityPassRate: number;
  fallbackRate: number;
  ratingCoverage: number;
}

const RATING_SCORE: Record<string, number> = {
  good: 1,
  okay: 0.65,
  bad: 0,
};

export function evaluateEpisodes(episodes: EpisodeRecord[]): EvaluationReport {
  if (!episodes.length) {
    return {
      promote: false,
      reason: 'No episodes available.',
      sampleSize: 0,
      acceptedRate: 0,
      avgRegenerateCount: 0,
      qualityScore: 0,
      qualityPassRate: 0,
      fallbackRate: 0,
      ratingCoverage: 0,
    };
  }

  const accepted = episodes.filter((episode) => episode.acceptedByUser).length;
  const acceptedRate = accepted / episodes.length;
  const avgRegenerateCount =
    episodes.reduce((acc, episode) => acc + episode.regenerateCount, 0) / episodes.length;

  const qualityPassCount = episodes.filter((episode) => episode.qualityGatePass !== false).length;
  const fallbackCount = episodes.filter((episode) => episode.fallbackShown).length;
  const ratedEpisodes = episodes.filter((episode) => Boolean(episode.userRating));
  const ratingCoverage = ratedEpisodes.length / episodes.length;

  const qualityScore =
    episodes.reduce((acc, episode) => {
      const ratingScore =
        episode.userRating && RATING_SCORE[episode.userRating] !== undefined
          ? RATING_SCORE[episode.userRating]
          : episode.acceptedByUser
            ? 0.8
            : 0.2;
      const gateAdjustment = episode.qualityGatePass === false ? -0.2 : 0.05;
      const fallbackPenalty = episode.fallbackShown ? -0.2 : 0;
      const retryPenalty = Math.min(0.2, (episode.regenerateCount || 0) * 0.08);
      const episodeScore = Math.max(0, Math.min(1, ratingScore + gateAdjustment + fallbackPenalty - retryPenalty));
      return acc + episodeScore;
    }, 0) / episodes.length;

  const qualityPassRate = qualityPassCount / episodes.length;
  const fallbackRate = fallbackCount / episodes.length;
  const promote =
    episodes.length >= 20 &&
    qualityScore >= 0.68 &&
    qualityPassRate >= 0.72 &&
    fallbackRate <= 0.2 &&
    avgRegenerateCount <= 1.3;

  const reason = promote
    ? 'Candidate passed quality, stability, and fallback thresholds.'
    : 'Candidate has not met minimum sample size or quality thresholds yet.';

  return {
    promote,
    reason,
    sampleSize: episodes.length,
    acceptedRate,
    avgRegenerateCount,
    qualityScore,
    qualityPassRate,
    fallbackRate,
    ratingCoverage,
  };
}
