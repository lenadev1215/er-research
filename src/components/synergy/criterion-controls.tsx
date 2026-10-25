"use client";

import { CRITERION_LABELS, type Criterion } from "@/lib/tier";
import { useSynergyUi } from "@/stores/synergy-ui";

const MIN_GAMES_OPTIONS = [ 1, 3, 5, 10, 30 ];

export function CriterionControls() {
  const criterion = useSynergyUi((s) => s.criterion);
  const setCriterion = useSynergyUi((s) => s.setCriterion);
  const minGames = useSynergyUi((s) => s.minGames);
  const setMinGames = useSynergyUi((s) => s.setMinGames);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div role="radiogroup" aria-label="티어 기준" className="flex rounded-md bg-rail p-1">
        {(Object.keys(CRITERION_LABELS) as Criterion[]).map((key) => {
          const active = key === criterion;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setCriterion(key)}
              className={`rounded px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf ${
                active ? "bg-surface text-ink shadow-[0_1px_0_var(--color-line)]" : "text-muted hover:text-ink"
              }`}
            >
              {CRITERION_LABELS[ key ]}
            </button>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm text-muted">
        최소 판수
        <select
          value={minGames}
          onChange={(e) => setMinGames(Number(e.target.value))}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf"
        >
          {MIN_GAMES_OPTIONS.map((n) => <option key={n} value={n}>{n}판</option>)}
        </select>
      </label>
    </div>
  );
}
