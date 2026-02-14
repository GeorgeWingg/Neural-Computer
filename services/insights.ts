/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import { GenerationRecord } from '../types';
import { evaluateEpisodes } from './evaluator';
import { listFeedbackEvents } from './feedbackTelemetry';
import { listGenerationRecords } from './generationTelemetry';
import { listEpisodes } from './interactionTelemetry';
import { listSkillTransitionEvents } from './selfImprovementCoordinator';
import { getSkillRegistry } from './skillRegistry';

export interface OverviewStats {
  totalEpisodes: number;
  windowEpisodes: number;
  acceptedRate: number;
  qualityPassRate: number;
  fallbackRate: number;
  retryRate: number;
  ratedCoverage: number;
  averageQualityScore: number;
  ratingCounts: { good: number; okay: number; bad: number };
}

export interface SkillInsightRow {
  skillId: string;
  title: string;
  status: string;
  score: number;
  confidence: number;
  uses: number;
  canaryAllocation: number;
  sampleSize: number;
  qualityScore: number;
  acceptedRate: number;
  fallbackRate: number;
  lastEvaluationReason: string;
  lastStatusChangeAt?: number;
}

export interface ExperimentsSummary {
  activeCanaries: number;
  recentTransitions: ReturnType<typeof listSkillTransitionEvents>;
}

export function getOverviewStats(windowSize = 50): OverviewStats {
  const episodes = listEpisodes().sort((a, b) => b.startedAt - a.startedAt);
  const recent = episodes.slice(0, windowSize);
  const ratingCounts = { good: 0, okay: 0, bad: 0 };

  for (const episode of recent) {
    if (episode.userRating === 'good') ratingCounts.good += 1;
    if (episode.userRating === 'okay') ratingCounts.okay += 1;
    if (episode.userRating === 'bad') ratingCounts.bad += 1;
  }

  const evalReport = evaluateEpisodes(recent);

  const qualityPassRate = recent.length
    ? recent.filter((episode) => episode.qualityGatePass !== false).length / recent.length
    : 0;
  const fallbackRate = recent.length
    ? recent.filter((episode) => episode.fallbackShown).length / recent.length
    : 0;
  const retryRate = recent.length
    ? recent.filter((episode) => episode.retryAttempted).length / recent.length
    : 0;
  const ratedCoverage = recent.length
    ? recent.filter((episode) => Boolean(episode.userRating)).length / recent.length
    : 0;

  return {
    totalEpisodes: episodes.length,
    windowEpisodes: recent.length,
    acceptedRate: evalReport.acceptedRate,
    qualityPassRate,
    fallbackRate,
    retryRate,
    ratedCoverage,
    averageQualityScore: evalReport.qualityScore,
    ratingCounts,
  };
}

export function getSkillInsights(windowSize = 80): SkillInsightRow[] {
  const skills = getSkillRegistry();
  const episodes = listEpisodes();

  return skills
    .map((skill) => {
      const related = episodes
        .filter((episode) => episode.appliedSkillIds.includes(skill.id))
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, windowSize);
      const report = evaluateEpisodes(related);
      return {
        skillId: skill.id,
        title: skill.title,
        status: skill.status,
        score: skill.score,
        confidence: skill.confidence,
        uses: skill.uses,
        canaryAllocation: skill.canaryAllocation ?? 0,
        sampleSize: report.sampleSize,
        qualityScore: report.qualityScore,
        acceptedRate: report.acceptedRate,
        fallbackRate: report.fallbackRate,
        lastEvaluationReason: skill.lastEvaluationReason || report.reason,
        lastStatusChangeAt: skill.lastStatusChangeAt,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function getGenerationTimeline(limit = 30): GenerationRecord[] {
  return listGenerationRecords(limit);
}

export function getExperimentsSummary(limit = 40): ExperimentsSummary {
  const skills = getSkillRegistry();
  return {
    activeCanaries: skills.filter((skill) => skill.status === 'canary').length,
    recentTransitions: listSkillTransitionEvents(limit),
  };
}

export function getRecentFeedbackCounts(limit = 120): { good: number; okay: number; bad: number } {
  const events = listFeedbackEvents(limit);
  return events.reduce(
    (acc, event) => {
      if (event.rating === 'good') acc.good += 1;
      if (event.rating === 'okay') acc.okay += 1;
      if (event.rating === 'bad') acc.bad += 1;
      return acc;
    },
    { good: 0, okay: 0, bad: 0 },
  );
}
