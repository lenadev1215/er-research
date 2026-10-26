"use client";

import type { SeasonMost } from "@/lib/report/types";
import { damage, percent } from "@/components/synergy/format";
import { CharacterImage } from "@/components/synergy/pick-badge";

// 원본 55px. 1배율 화면에서는 선명하고, 2배율에서는 약간 흐려지는 것을 감수한다.
const PORTRAIT_PX = 44;

// 시즌 랭크 모스트 3개. 판수·승률·TOP3율은 시즌 통계, 딜량·TK는 시즌 통계에 없어 최근 경기에서 같은 실험체를 쓴 판의 평균이다.
export function SeasonMostList({ most }: { most: SeasonMost[] }) {
  return (
    <section aria-labelledby="season-most-heading" className="flex flex-col gap-3">
      <h3 id="season-most-heading" className="text-xs font-semibold text-ink">시즌 모스트 (랭크)</h3>
      <ol className="grid grid-cols-3 gap-2 sm:gap-3">
        {most.map((m) => (
          <li key={m.characterCode} className="flex min-w-0 flex-col items-center gap-2 rounded-md bg-surface px-2 py-4 sm:px-4">
            <CharacterImage code={m.characterCode} name={m.characterName} px={PORTRAIT_PX} />
            <span title={m.characterName} className="max-w-full truncate text-sm font-semibold text-ink">{m.characterName}</span>
            <dl className="flex w-full flex-col gap-1 text-xs">
              <Row label="판수" value={`${ m.games }판`} />
              <Row label="승률" value={percent(m.winRate)} />
              <Row label="TOP3율" value={percent(m.top3Rate)} />
              <Row label="딜량" value={m.recent ? damage(m.recent.avgDamage) : "-"} />
              <Row label="TK" value={m.recent ? m.recent.avgTeamKill.toFixed(1) : "-"} />
            </dl>
            <p className="text-center text-[11px] leading-tight text-muted">
              {m.recent ? `딜량·TK는 최근 ${ m.recent.games }판 기준` : "최근 경기에서 쓰지 않음"}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
