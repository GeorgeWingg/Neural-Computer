/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import React, { useEffect, useMemo, useState } from 'react';
import { getExperimentsSummary, getGenerationTimeline, getOverviewStats, getRecentFeedbackCounts, getSkillInsights } from '../services/insights';

type InsightsTab = 'overview' | 'skills' | 'generations' | 'experiments';

const formatPct = (value: number) => `${Math.round(value * 100)}%`;

const formatTs = (value?: number) => {
  if (!value) return 'n/a';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'n/a';
  }
};

export const InsightsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<InsightsTab>('overview');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRefreshTick((v) => v + 1), 4000);
    return () => clearInterval(timer);
  }, []);

  const overview = useMemo(() => getOverviewStats(80), [refreshTick]);
  const skillRows = useMemo(() => getSkillInsights(100), [refreshTick]);
  const generations = useMemo(() => getGenerationTimeline(30), [refreshTick]);
  const experiments = useMemo(() => getExperimentsSummary(40), [refreshTick]);
  const feedbackCounts = useMemo(() => getRecentFeedbackCounts(120), [refreshTick]);

  return (
    <div className="h-full overflow-y-auto bg-[#060b16] text-white p-5">
      <section className="mb-5 rounded-xl border border-amber-500/55 bg-[#1a1206] overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.38)]">
        <div
          style={{
            height: '12px',
            background:
              'repeating-linear-gradient(-45deg, #f59e0b 0 16px, #111827 16px 32px, #ef4444 32px 48px, #111827 48px 64px)',
          }}
        />
        <div className="px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-amber-300">
            Under Construction
          </div>
          <p className="mt-1 text-sm leading-snug text-amber-100">
            Insights is mostly under construction in this beta. This page is a fallback view; the long-term Insights experience will be model generated.
          </p>
        </div>
        <div
          style={{
            height: '10px',
            background:
              'repeating-linear-gradient(45deg, #f59e0b 0 16px, #111827 16px 32px, #ef4444 32px 48px, #111827 48px 64px)',
          }}
        />
      </section>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-blue-300">Insights (Beta Fallback)</h2>
          <p className="text-xs text-blue-100/70">Observe quality trends, skill rollouts, and generation diffs.</p>
        </div>
        <button
          onClick={() => setRefreshTick((v) => v + 1)}
          className="px-3 py-1 text-xs rounded border border-blue-700 hover:bg-blue-900/30"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['overview', 'skills', 'generations', 'experiments'] as InsightsTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-[#0b1324] border-[#1b2a45] text-blue-200 hover:bg-[#13213c]'
            }`}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded border border-[#1b2a45] bg-[#0b1324] p-3">
              <div className="text-xs text-blue-200/70">Episodes (window)</div>
              <div className="text-2xl font-semibold">{overview.windowEpisodes}</div>
              <div className="text-[11px] text-blue-200/60">Total stored: {overview.totalEpisodes}</div>
            </div>
            <div className="rounded border border-[#1b2a45] bg-[#0b1324] p-3">
              <div className="text-xs text-blue-200/70">Quality Score</div>
              <div className="text-2xl font-semibold">{formatPct(overview.averageQualityScore)}</div>
              <div className="text-[11px] text-blue-200/60">Explicit rating coverage: {formatPct(overview.ratedCoverage)}</div>
            </div>
            <div className="rounded border border-[#1b2a45] bg-[#0b1324] p-3">
              <div className="text-xs text-blue-200/70">Feedback Mix</div>
              <div className="text-sm mt-2">Good {feedbackCounts.good} | Okay {feedbackCounts.okay} | Bad {feedbackCounts.bad}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border border-[#1b2a45] bg-[#0b1324] p-3 space-y-1">
              <div className="text-sm font-semibold text-blue-300">Runtime Quality</div>
              <div className="text-xs">Accepted rate: {formatPct(overview.acceptedRate)}</div>
              <div className="text-xs">Quality gate pass: {formatPct(overview.qualityPassRate)}</div>
              <div className="text-xs">Fallback rate: {formatPct(overview.fallbackRate)}</div>
              <div className="text-xs">Retry rate: {formatPct(overview.retryRate)}</div>
            </div>
            <div className="rounded border border-[#1b2a45] bg-[#0b1324] p-3 space-y-1">
              <div className="text-sm font-semibold text-blue-300">Interpretation</div>
              <div className="text-xs text-blue-100/75">Quality gate and explicit feedback are now first-class learning signals.</div>
              <div className="text-xs text-blue-100/75">If fallback rate rises, canary skills should get demoted automatically.</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="rounded border border-[#1b2a45] overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-[#0b1324] text-blue-300">
              <tr>
                <th className="text-left p-2">Skill</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Score</th>
                <th className="text-left p-2">Conf</th>
                <th className="text-left p-2">Canary</th>
                <th className="text-left p-2">Sample</th>
                <th className="text-left p-2">Quality</th>
                <th className="text-left p-2">Last Change</th>
              </tr>
            </thead>
            <tbody>
              {skillRows.map((row) => (
                <tr key={row.skillId} className="border-t border-[#1b2a45] bg-[#091120]">
                  <td className="p-2">
                    <div className="font-medium">{row.title}</div>
                    <div className="text-[10px] text-blue-100/60">{row.skillId}</div>
                  </td>
                  <td className="p-2 uppercase">{row.status}</td>
                  <td className="p-2">{row.score.toFixed(2)}</td>
                  <td className="p-2">{row.confidence.toFixed(2)}</td>
                  <td className="p-2">{Math.round(row.canaryAllocation * 100)}%</td>
                  <td className="p-2">{row.sampleSize}</td>
                  <td className="p-2">{formatPct(row.qualityScore)}</td>
                  <td className="p-2">{formatTs(row.lastStatusChangeAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'generations' && (
        <div className="space-y-3">
          {generations.map((generation) => (
            <div key={generation.id} className="rounded border border-[#1b2a45] bg-[#0b1324] p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-semibold text-blue-300">{generation.appContext}</div>
                  <div className="text-[10px] text-blue-100/60">{formatTs(generation.createdAt)} | {generation.id}</div>
                </div>
                <div className={`text-[10px] px-2 py-1 rounded ${generation.qualityGatePass ? 'bg-emerald-900/40 text-emerald-200' : 'bg-red-900/40 text-red-200'}`}>
                  {generation.qualityGatePass ? 'Gate Pass' : 'Gate Fail'}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-blue-100/80 mb-2">
                <div>Interactions: {generation.metrics.interactionCount}</div>
                <div>Text: {generation.metrics.textLength}</div>
                <div>Scripts: {generation.metrics.scriptCount}</div>
                <div>Styles: {generation.metrics.styleCount}</div>
              </div>
              <div className="text-[11px] text-blue-100/75">
                Diff ratio: {generation.diff?.structureChangeRatio?.toFixed(2) ?? 'n/a'} | Δtext {generation.diff?.deltaTextLength ?? 0} | Δactions {generation.diff?.deltaInteractionCount ?? 0}
              </div>
              {generation.qualityReasonCodes.length > 0 && (
                <div className="text-[11px] text-amber-200 mt-1">Reasons: {generation.qualityReasonCodes.join(', ')}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'experiments' && (
        <div className="space-y-3">
          <div className="rounded border border-[#1b2a45] bg-[#0b1324] p-3 text-sm">
            Active canaries: <span className="font-semibold text-blue-300">{experiments.activeCanaries}</span>
          </div>
          <div className="rounded border border-[#1b2a45] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#0b1324] text-blue-300">
                <tr>
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Skill</th>
                  <th className="text-left p-2">Transition</th>
                  <th className="text-left p-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {experiments.recentTransitions.map((event) => (
                  <tr key={event.id || `${event.skillId}_${event.timestamp}`} className="border-t border-[#1b2a45] bg-[#091120]">
                    <td className="p-2">{formatTs(event.timestamp)}</td>
                    <td className="p-2">{event.skillId}</td>
                    <td className="p-2 uppercase">{event.from} → {event.to}</td>
                    <td className="p-2">{event.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
