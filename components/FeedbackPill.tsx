/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/* tslint:disable */
import React from 'react';
import { EpisodeRating } from '../types';

interface FeedbackPillProps {
  visible: boolean;
  expanded: boolean;
  isFailureContext: boolean;
  selectedRating: EpisodeRating | null;
  selectedReasons: string[];
  onToggleExpanded: () => void;
  onRate: (rating: EpisodeRating) => void;
  onToggleReason: (reason: string) => void;
}

const REASON_TAGS = ['Layout', 'Readability', 'Navigation', 'Visual Style', 'Too Sparse', 'Too Noisy'];

export const FeedbackPill: React.FC<FeedbackPillProps> = ({
  visible,
  expanded,
  isFailureContext,
  selectedRating,
  selectedReasons,
  onToggleExpanded,
  onRate,
  onToggleReason,
}) => {
  if (!visible) return null;

  const chromeClasses = isFailureContext
    ? 'border-red-500 bg-[#220b0b] text-red-100'
    : 'border-blue-700 bg-[#081425] text-blue-100';

  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
      <div className="relative w-[328px] h-[320px]">
        <button
          onClick={onToggleExpanded}
          className={`pointer-events-auto absolute top-1/2 -translate-y-1/2 transition-all duration-200 ease-out ${
            expanded ? 'right-[288px]' : 'right-0'
          } h-[120px] w-10 rounded-l-md border border-r-0 shadow-xl text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl] ${chromeClasses} ${
            isFailureContext ? 'hover:bg-red-900/30' : 'hover:bg-blue-900/30'
          }`}
          aria-label={expanded ? 'Close feedback panel' : 'Open feedback panel'}
        >
          Feedback
        </button>

        <div
          className={`pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 w-[288px] rounded-l-xl border border-r-0 shadow-2xl transition-transform duration-200 ease-out ${chromeClasses} ${
            expanded ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="px-3 py-2 border-b border-white/15">
            <div className="text-xs font-semibold">Screen Feedback</div>
            <div className="text-[10px] opacity-75">Used for self-improvement scoring</div>
          </div>

          <div className="px-3 pb-3 pt-2">
            <div className="flex gap-2 mb-2">
              {([
                { label: 'Good', value: 'good' },
                { label: 'Okay', value: 'okay' },
                { label: 'Bad', value: 'bad' },
              ] as const).map((item) => (
                <button
                  key={item.value}
                  onClick={() => onRate(item.value)}
                  className={`px-2 py-1 rounded text-xs border ${
                    selectedRating === item.value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-[#0e1a31] border-[#1b2a45] text-blue-100 hover:bg-[#16274a]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1">
              {REASON_TAGS.map((reason) => {
                const selected = selectedReasons.includes(reason);
                return (
                  <button
                    key={reason}
                    onClick={() => onToggleReason(reason)}
                    className={`px-2 py-1 rounded text-[10px] border ${
                      selected
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-[#0e1a31] border-[#1b2a45] text-blue-100/90 hover:bg-[#16274a]'
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
