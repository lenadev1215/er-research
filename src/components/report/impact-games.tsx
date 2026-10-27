"use client";

import type { GameImpact, RecentGame, ReportMode } from "@/lib/report/types";
import { damage, percent } from "@/components/synergy/format";
import { PickBadge } from "@/components/synergy/pick-badge";

const MODE_LABEL: Record<ReportMode, string> = { rankSquad: "랭크", normalSquad: "일반", other: "기타" };

// 딜량의 같은 실험체 TOP3 판 평균 대비 배율. 판정에는 KDA 배율도 쓰지만 화면에는 딜량만 보여준다 (사용자 결정).
const ratio = (v: number | null) => ( v === null ? null : `평균의 ${ v.toFixed(1) }배` );

// 캐리·버스 판 목록. 판 번호는 20판 띠와 같다 (오래된 판부터 1번).
export function ImpactGames({ games, impact }: { games: RecentGame[]; impact: GameImpact }) {
  const rows = games.flatMap((g, i) => ( g.impact === impact && g.detail ? [ { g, detail: g.detail, no: i + 1 } ] : [] ));
  if ( rows.length === 0 ) {
    return <p className="rounded-md bg-surface px-4 py-3 text-xs text-muted">{impact === "carry" ? "캐리한 판이 없습니다." : "버스 탄 판이 없습니다."}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-line rounded-md bg-surface">
      {rows.map(({ g, detail, no }) => (
        <li key={no} className="grid items-center gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:px-5">
          <div className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-xs tabular-nums text-muted">{no}번째 판</span>
            <PickBadge pick={g.pick} variant="inline" />
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <Item label="순위" value={`${ g.rank }위 / ${ g.teams }팀`} note={MODE_LABEL[ g.mode ]} />
            <Item
              label="딜량"
              value={damage(g.damage)}
              note={ratio(detail.damageRatio)}
              noteClass={impact === "carry" ? "text-carry" : "text-bus"}
              title="같은 실험체가 TOP3로 끝난 판의 평균 딜량과 비교한 배율입니다"
            />
            <Item
              label="팀 딜량"
              value={detail.teamDamage === null ? "-" : damage(detail.teamDamage)}
              note={detail.teamDamage ? `내 몫 ${ percent(g.damage / detail.teamDamage) }` : null}
            />
            <Item label="KDA" value={detail.kda.toFixed(1)} />
            <Item label="킬·어시·데스" value={`${ detail.kills } / ${ detail.assists } / ${ detail.deaths }`} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

type ItemProps = { label: string; value: string; note?: string | null; noteClass?: string; title?: string };

function Item({ label, value, note, noteClass = "text-muted", title }: ItemProps) {
  return (
    <div title={title} className="flex items-baseline gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{value}</dd>
      {note && <dd className={`tabular-nums ${ noteClass }`}>{note}</dd>}
    </div>
  );
}
