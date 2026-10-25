"use client";

import { useIncrementalList } from "@/hooks/use-incremental-list";
import type { RankedCombo, Tier } from "@/lib/tier";
import { useSynergyUi, type SortKey } from "@/stores/synergy-ui";
import { percent, signedRp } from "./format";
import { PickGroup } from "./pick-badge";

// 등급 농도: S가 가장 진한 VF 보라, D로 갈수록 회색
const TIER_BADGE: Record<Tier, string> = {
  S: "bg-tier-s text-white",
  A: "bg-tier-a text-white",
  B: "bg-tier-b text-ink",
  C: "bg-tier-c text-ink",
  D: "bg-tier-d text-muted",
};

function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      aria-label={`${ tier } 등급`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded font-display text-xl leading-none font-extrabold ${ TIER_BADGE[ tier ] }`}
    >
      {tier}
    </span>
  );
}

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string; render: (c: RankedCombo) => string }> = [
  { key: "score", label: "등급", render: (c) => c.tier },
  { key: "games", label: "판수", render: (c) => String(c.games) },
  { key: "winRate", label: "1위율", render: (c) => percent(c.winRate) },
  { key: "top3Rate", label: "TOP3율", render: (c) => percent(c.top3Rate) },
  { key: "avgRp", label: "평균 RP", render: (c) => signedRp(c.avgRp) },
  { key: "avgRank", label: "평균 순위", render: (c) => c.avgRank.toFixed(1) },
];

export function ComboTable({ combos, groupLabel }: { combos: RankedCombo[]; groupLabel: string }) {
  const sort = useSynergyUi((s) => s.sort);
  const toggleSort = useSynergyUi((s) => s.toggleSort);

  const sorted = [ ...combos ].sort((x, y) => {
    const diff = x[ sort.key ] - y[ sort.key ];
    return sort.dir === "asc" ? diff : -diff;
  });
  // combos는 부모에서 메모해 둔 배열이라, 선택·기준·최소 판수가 바뀔 때만 참조가 바뀐다.
  const { visibleCount, hasMore, showMore, sentinelRef } = useIncrementalList(sorted.length, [ combos, sort.key, sort.dir ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-md bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">{groupLabel}별 상세 지표. 열 제목을 눌러 정렬합니다.</caption>
          <thead>
            <tr className="border-b border-line text-muted">
              <th scope="col" className="px-4 py-3 text-left font-medium">{groupLabel}</th>
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
            {sorted.slice(0, visibleCount).map((c) => (
              <tr key={c.key} className="border-b border-line/60 last:border-b-0">
                <td className="px-4 py-2.5">
                  <PickGroup mates={c.mates} size="sm" />
                </td>
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2.5 text-right tabular-nums ${
                      col.key === "avgRp" ? (c.avgRp < 0 ? "text-alert" : "text-vf") : "text-ink"
                    }`}
                  >
                    {col.key === "score" ? <TierBadge tier={c.tier} /> : col.render(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <>
          <div ref={sentinelRef} aria-hidden />
          <button
            type="button"
            onClick={showMore}
            className="self-center rounded-md px-4 py-2 text-sm text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf"
          >
            더 보기 ({visibleCount}/{sorted.length}개 표시 중)
          </button>
        </>
      )}
    </div>
  );
}
