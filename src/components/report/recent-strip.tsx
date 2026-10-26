import type { CSSProperties } from "react";
import type { RecentGame, ReportMode } from "@/lib/report/types";

const MODE_LABEL: Record<ReportMode, string> = {
  rankSquad: "랭크 스쿼드",
  normalSquad: "일반 스쿼드",
  other: "기타 모드",
};

// 모드 표식: 랭크는 채운 칸, 일반은 테두리 칸, 기타는 점. DB와 직접 비교되는 판일수록 진하다.
const MODE_MARK: Record<ReportMode, string> = {
  rankSquad: "h-2 rounded-[2px] bg-ink",
  normalSquad: "h-2 rounded-[2px] border border-ink",
  other: "h-1.5 w-1.5 rounded-full bg-muted",
};
// 판별 기여 표식 (TOP3 판만): 캐리는 채운 삼각형, 버스는 빈 원. 막대 위에 얹는다.
const IMPACT_LABEL = { carry: "캐리", bus: "버스" } as const;

const markWidth = (mode: ReportMode, inLegend: boolean) => ( mode === "other" ? "mx-auto" : inLegend ? "w-3" : "w-full" );

// 팀 수가 모드마다 달라 순위를 0~1로 정규화한다. 1위가 가장 높고, 꼴찌도 보이도록 바닥 높이를 둔다.
const barHeight = ({ rank, teams }: RecentGame) =>
  `${ 14 + 86 * ( teams > 1 ? ( teams - rank ) / ( teams - 1 ) : 1 ) }%`;

// 최근 경기를 오래된 판부터 한 줄로 늘어놓는다. 막대 = 순위, 색 = TOP3, 막대 위 표식 = 캐리·버스, 아래 칸 = 모드.
export function RecentStrip({ games }: { games: RecentGame[] }) {
  return (
    <figure className="flex flex-col gap-3">
      <ol aria-label={`최근 ${ games.length }판, 오래된 판부터`} className="grid animate-settle grid-cols-[repeat(var(--n),minmax(0,1fr))] gap-1 sm:gap-1.5" style={{ "--n": games.length } as CSSProperties}>
        {games.map((g, i) => {
          const top3 = g.rank <= 3;
          // 이전 형식으로 저장한 고정 데이터(개발용)에는 impact가 없다.
          const impact = g.impact ?? null;
          const label = `${ i + 1 }번째 판: ${ MODE_LABEL[ g.mode ] }, ${ g.teams }팀 중 ${ g.rank }위, ${ g.pick.characterName } ${ g.pick.weaponName }${ g.rp === null ? "" : `, RP ${ g.rp > 0 ? "+" : "" }${ g.rp }` }${ impact ? `, ${ IMPACT_LABEL[ impact ] }` : "" }`;
          return (
            <li key={i} title={label} className="flex flex-col gap-1.5">
              <span className="sr-only">{label}</span>
              <span aria-hidden className="flex h-20 flex-col justify-end gap-1 sm:h-24">
                {impact && <ImpactMark impact={impact} />}
                <span style={{ height: barHeight(g) }} className={`w-full shrink-0 rounded-t-[3px] ${ top3 ? "bg-vf" : "bg-tier-c" }`} />
              </span>
              <span aria-hidden className={`text-center text-xs tabular-nums ${ g.rank === 1 ? "font-semibold text-vf" : "text-muted" }`}>
                {g.rank}
              </span>
              <span aria-hidden className={`${ MODE_MARK[ g.mode ] } ${ markWidth(g.mode, false) }`} />
            </li>
          );
        })}
      </ol>
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span>막대가 높을수록 높은 순위, 보라색은 TOP3입니다.</span>
        {( [ "carry", "bus" ] as const ).map((impact) => (
          <span key={impact} className="inline-flex items-center gap-1.5">
            <ImpactMark impact={impact} />
            {IMPACT_LABEL[ impact ]}
          </span>
        ))}
        {( Object.keys(MODE_LABEL) as ReportMode[] ).map((mode) => (
          <span key={mode} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={`${ MODE_MARK[ mode ] } ${ markWidth(mode, true) }`} />
            {MODE_LABEL[ mode ]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function ImpactMark({ impact }: { impact: "carry" | "bus" }) {
  return impact === "carry"
    ? <span aria-hidden className="mx-auto h-0 w-0 border-x-[4px] border-b-[6px] border-x-transparent border-b-ink" />
    : <span aria-hidden className="mx-auto h-1.5 w-1.5 rounded-full border border-muted" />;
}
