"use client";

import { useIncrementalList } from "@/hooks/use-incremental-list";
import { compareRank, type RankedCombo } from "@/lib/tier";
import { useSynergyUi, type SortKey } from "@/stores/synergy-ui";
import { percent, signedRp } from "./format";
import { PickGroup } from "./pick-badge";
import { TierBadge } from "./tier-badge";

// 열 폭을 고정해 두면 행을 더 그리거나 정렬을 바꿔도 열이 흔들리지 않는다.
// 조합 열만 폭을 정하고, 숫자 열은 남는 폭을 똑같이 나눈다. short는 모바일 지표 제목.
const COMBO_COLUMN_WIDTH = 208;
const COLUMNS: ReadonlyArray<{ key: SortKey; label: string; short: string; render: (c: RankedCombo) => string }> = [
  { key: "score", label: "등급", short: "등급", render: (c) => c.tier },
  { key: "games", label: "판수", short: "판수", render: (c) => String(c.games) },
  { key: "winRate", label: "1위율", short: "1위율", render: (c) => percent(c.winRate) },
  { key: "top3Rate", label: "TOP3율", short: "TOP3", render: (c) => percent(c.top3Rate) },
  { key: "avgRp", label: "평균 RP", short: "RP", render: (c) => signedRp(c.avgRp) },
  { key: "avgRank", label: "평균 순위", short: "순위", render: (c) => c.avgRank.toFixed(1) },
  { key: "avgTk", label: "평균 TK", short: "TK", render: (c) => c.avgTk === null ? "-" : c.avgTk.toFixed(1) },
];
const METRICS = COLUMNS.filter((col) => col.key !== "score");

const valueTone = (key: SortKey, c: RankedCombo) =>
  key === "avgRp" ? (c.avgRp < 0 ? "text-alert" : "text-vf") : "text-ink";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf";

type Props = {
  combos: RankedCombo[];
  groupLabel: string;
  showTier: boolean; // 등급은 종합 기준일 때만 보여준다. 다른 기준에서는 score가 정렬용으로만 쓰인다.
};

// md(768px) 이상은 표, 그 아래는 행을 두 줄로 접은 목록으로 보여준다. 가로 스크롤이 생기지 않게 한다.
export function ComboTable({ combos, groupLabel, showTier }: Props) {
  const sort = useSynergyUi((s) => s.sort);
  const toggleSort = useSynergyUi((s) => s.toggleSort);
  const setSortKey = useSynergyUi((s) => s.setSortKey);

  const columns = showTier ? COLUMNS : METRICS;
  // TK가 아직 없는 조합(null)은 정렬 방향과 관계없이 맨 뒤로 보낸다.
  const sorted = [ ...combos ].sort((x, y) => {
    if ( sort.key === "score" ) return sort.dir === "desc" ? compareRank(x, y) : compareRank(y, x);
    const a = x[ sort.key ];
    const b = y[ sort.key ];
    if ( a === null || b === null ) return a === b ? 0 : a === null ? 1 : -1;
    return sort.dir === "asc" ? a - b : b - a;
  });
  // combos는 부모에서 메모해 둔 배열이라, 선택·기준·최소 판수가 바뀔 때만 참조가 바뀐다.
  const { visibleCount, hasMore, showMore, sentinelRef } = useIncrementalList(sorted.length, [ combos, sort.key, sort.dir ]);
  const visible = sorted.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-3">
      {/* 모바일에는 열 제목이 없어 정렬을 선택 상자로 고른다. 데스크톱 열 제목 정렬과 같은 상태를 쓴다. */}
      <label className="flex items-center gap-2 self-end text-sm text-muted md:hidden">
        정렬
        <select
          value={sort.key}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className={`rounded-md border border-line bg-surface pr-8 pl-3 py-1.5 text-ink ${ FOCUS_RING }`}
        >
          {COLUMNS.map((col) => (
            <option key={col.key} value={col.key}>
              {col.key === "score" && !showTier ? "기준 순서" : col.label}
            </option>
          ))}
        </select>
      </label>

      <div className="hidden rounded-md bg-surface md:block">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">{groupLabel}별 상세 지표. 열 제목을 눌러 정렬합니다.</caption>
          <colgroup>
            <col style={{ width: COMBO_COLUMN_WIDTH }} />
            {columns.map((col) => <col key={col.key} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-line text-muted">
              <th scope="col" className="px-4 py-3 text-left font-medium">{groupLabel}</th>
              {columns.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className="px-2 py-3 text-center font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`rounded px-1 ${ FOCUS_RING } ${ active ? "text-ink" : "hover:text-ink" }`}
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
            {visible.map((c) => (
              <tr key={c.key} className="border-b border-line/60 last:border-b-0">
                <td className="px-4 py-2.5">
                  <PickGroup mates={c.mates} />
                </td>
                {columns.map((col) => (
                  <td key={col.key} className={`px-2 py-2.5 text-center tabular-nums ${ valueTone(col.key, c) }`}>
                    {col.key === "score" ? <TierBadge tier={c.tier} /> : col.render(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={`${ groupLabel }별 상세 지표`} className="rounded-md bg-surface md:hidden">
        {visible.map((c) => (
          <li key={c.key} className="flex gap-3 border-b border-line/60 px-4 py-3 last:border-b-0">
            {showTier && <TierBadge tier={c.tier} tall />}
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <PickGroup mates={c.mates} variant="inline" />
              <dl className="grid grid-cols-3 gap-y-2 text-center">
                {METRICS.map((col) => (
                  <div key={col.key} className="flex flex-col gap-0.5">
                    <dt className="text-[11px] text-muted">{col.short}</dt>
                    <dd className={`text-[13px] tracking-tight tabular-nums ${ valueTone(col.key, c) }`}>{col.render(c)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <>
          <div ref={sentinelRef} aria-hidden />
          <button
            type="button"
            onClick={showMore}
            className={`self-center rounded-md px-4 py-2 text-sm text-muted hover:text-ink ${ FOCUS_RING }`}
          >
            더 보기 ({visibleCount}/{sorted.length}개 표시 중)
          </button>
        </>
      )}
    </div>
  );
}
