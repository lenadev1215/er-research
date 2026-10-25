"use client";

import type { RankedCombo } from "@/lib/tier";
import { useSynergyUi, type SortKey } from "@/stores/synergy-ui";
import { percent, signedRp } from "./format";
import { PickPair } from "./pick-badge";

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string; render: (c: RankedCombo) => string }> = [
  { key: "score", label: "등급", render: (c) => c.tier },
  { key: "games", label: "판수", render: (c) => String(c.games) },
  { key: "winRate", label: "1위율", render: (c) => percent(c.winRate) },
  { key: "top3Rate", label: "TOP3율", render: (c) => percent(c.top3Rate) },
  { key: "avgRp", label: "평균 RP", render: (c) => signedRp(c.avgRp) },
  { key: "avgRank", label: "평균 순위", render: (c) => c.avgRank.toFixed(1) },
];

export function ComboTable({ combos }: { combos: RankedCombo[] }) {
  const sort = useSynergyUi((s) => s.sort);
  const toggleSort = useSynergyUi((s) => s.toggleSort);

  const sorted = [ ...combos ].sort((x, y) => {
    const diff = x[ sort.key ] - y[ sort.key ];
    return sort.dir === "asc" ? diff : -diff;
  });

  return (
    <div className="overflow-x-auto rounded-md bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">판정된 팀원 조합의 상세 지표. 열 제목을 눌러 정렬합니다.</caption>
        <thead>
          <tr className="border-b border-line text-muted">
            <th scope="col" className="px-4 py-3 text-left font-medium">팀원 조합</th>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className="px-3 py-3 text-right font-medium"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={`rounded px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf ${ active ? "text-ink" : "hover:text-ink" }`}
                  >
                    {col.label}
                    <span aria-hidden className="ml-1 inline-block w-2">{active ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.key} className="border-b border-line/60 last:border-b-0">
              <td className="px-4 py-2.5">
                <PickPair mates={c.mates} size="sm" />
              </td>
              {COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2.5 text-right tabular-nums ${
                    col.key === "avgRp" ? (c.avgRp < 0 ? "text-alert" : "text-vf") : col.key === "score" ? "font-display text-base font-bold text-ink" : "text-ink"
                  }`}
                >
                  {col.render(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
