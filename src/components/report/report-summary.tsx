"use client";

import { useState, type ReactNode } from "react";
import type { GameImpact, ImpactSummary, MyMetrics, Playstyle, RecentGame, ReportTeam, ReportVision, SeasonMost, TeamRole } from "@/lib/report/types";
import { damage, percent, signedRp } from "@/components/synergy/format";
import { ImpactGames } from "./impact-games";
import { SeasonMostList } from "./season-most";

type Metric = { label: string; value: string; note?: string | null };

const ROLE_LABEL: Record<TeamRole, string> = {
  kill: "킬 캐치",
  damage: "딜 담당",
  balanced: "균형",
};

// 최근 경기 전체 지표를 한 줄로. RP는 랭크 경기만으로 낸 값이다.
// 시야 점수는 기준 50이고, 아래에 같은 실험체를 쓴 수집 데이터의 평균을 붙인다.
// 그 아래 시즌 모스트, 팀 기여 순. 딜 점유율은 팀 정보가 있는 판으로만 낸다.
type Props = {
  overall: MyMetrics;
  vision: ReportVision;
  team: ReportTeam | undefined;
  impact: ImpactSummary | undefined;
  most: SeasonMost[] | undefined;
  playstyle: Playstyle | null | undefined;
  recent: RecentGame[];
};

const PLAYSTYLE: Record<Playstyle, { label: string; title: string }> = {
  vision: { label: "시야 장악", title: "TOP3 판의 시야 점수가 같은 실험체의 TOP3 판 평균보다 5점 이상 높습니다" },
  survivor: { label: "생존왕", title: "TOP3 판의 시야 점수가 같은 실험체의 TOP3 판 평균보다 5점 이상 높고, 데스는 같은 실험체 평균보다 적습니다" },
};

export function ReportSummary({ overall, vision, team, impact, most, playstyle, recent }: Props) {
  // 이전 형식으로 저장한 고정 데이터(개발용)에는 score·team이 없을 수 있어 undefined도 없음으로 본다.
  const score = vision.all.score ?? null;
  const refScore = vision.ref?.score ?? null;
  const metrics: Metric[] = [
    { label: "평균 순위", value: overall.avgRank.toFixed(1) },
    { label: "TOP3율", value: percent(overall.top3Rate) },
    { label: "1위율", value: percent(overall.winRate) },
    { label: "평균 RP (랭크)", value: overall.avgRp === null ? "-" : signedRp(overall.avgRp) },
    { label: "평균 딜량", value: damage(overall.avgDamage) },
    {
      label: "시야 점수",
      value: score === null ? "-" : score.toFixed(0),
      note: refScore === null ? null : `같은 실험체 평균 ${ refScore.toFixed(0) }`,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <MetricList metrics={metrics} />
      {most && most.length > 0 && <SeasonMostList most={most} />}
      {team && <TeamRow team={team} impact={impact} playstyle={playstyle ?? null} recent={recent} />}
    </div>
  );
}

// 캐리·버스는 TOP3 판 중 같은 실험체 평균과 비교해 판정한 판수다.
type TeamRowProps = { team: ReportTeam; impact: ImpactSummary | undefined; playstyle: Playstyle | null; recent: RecentGame[] };

function TeamRow({ team, impact, playstyle, recent }: TeamRowProps) {
  // 펼친 목록 (캐리 / 버스 / 닫힘). 이전 형식 고정 데이터에는 판별 기록(detail)이 없어 목록이 비어 보인다.
  const [ open, setOpen ] = useState<GameImpact | null>(null);
  const { me, ref } = team;
  const share = (v: number | null | undefined) => ( v == null ? "-" : percent(v) );
  const refNote = (v: number | null | undefined, format: (x: number) => string) => ( v == null ? null : `같은 실험체 평균 ${ format(v) }` );
  const metrics: Metric[] = [
    { label: "평균 TK", value: me.teamKill.toFixed(1), note: refNote(ref?.teamKill, (x) => x.toFixed(1)) },
    { label: "킬 점유율", value: share(me.killShare), note: refNote(ref?.killShare, percent) },
    { label: "킬 관여율", value: share(me.involvement), note: refNote(ref?.involvement, percent) },
    {
      label: `딜 점유율 (${ me.damageGames }판)`,
      value: share(me.damageShare),
      note: refNote(ref?.damageShare, percent),
    },
  ];
  const toggles = impact && ( [ [ "carry", "캐리한 판", impact.carry ], [ "bus", "버스 탄 판", impact.bus ] ] as const ).map(([ key, label, count ]) => (
    <div key={key} className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd>
        <button
          type="button"
          aria-expanded={open === key}
          aria-controls="impact-games"
          onClick={() => setOpen(open === key ? null : key)}
          className={`inline-flex items-center gap-1 rounded text-lg font-semibold tabular-nums underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-vf ${ open === key ? "text-vf" : "text-ink" }`}
        >
          {count}판
          <span aria-hidden className={`text-xs transition-transform ${ open === key ? "rotate-180" : "" }`}>▾</span>
        </button>
      </dd>
      <dd className="text-xs tabular-nums text-muted">TOP3 {impact.top3}판 중</dd>
    </div>
  ));

  return (
    <section aria-labelledby="team-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="team-heading" className="text-xs font-semibold text-ink">팀 기여</h3>
        {/* 순서: 딜 담당·킬 캐치 → 생존왕·시야 장악 → 균형(다른 뱃지가 없을 때만) (사용자 결정) */}
        {( team.role === "damage" || team.role === "kill" ) && <RoleBadge role={team.role} />}
        {playstyle && (
          <span title={PLAYSTYLE[ playstyle ].title} className="rounded-full bg-vf px-2 py-0.5 text-[11px] font-semibold text-white">
            {PLAYSTYLE[ playstyle ].label}
          </span>
        )}
        {( team.role === null || ( team.role === "balanced" && !playstyle ) ) && <RoleBadge role={team.role} />}
      </div>
      <MetricList metrics={metrics} extra={toggles} />
      {open && (
        <div id="impact-games">
          <ImpactGames games={recent} impact={open} />
        </div>
      )}
    </section>
  );
}

// 팀 내 역할 뱃지. 같은 실험체 평균 대비 킬·딜 점유율 우위로 판정한다 (lib/report/team.ts). 판정할 수 없으면 흐리게 둔다.
function RoleBadge({ role }: { role: TeamRole | null }) {
  if ( role === null ) {
    return (
      <span title="팀 정보가 있는 판이 없어 역할을 판단하지 못했습니다" className="rounded-full bg-rail px-2 py-0.5 text-[11px] text-muted">
        역할 판단 불가
      </span>
    );
  }
  return (
    <span title="같은 실험체 평균과 비교한 킬 점유율·딜 점유율로 판정했습니다" className="rounded-full bg-vf/10 px-2 py-0.5 text-[11px] font-semibold text-vf">
      {ROLE_LABEL[ role ]}
    </span>
  );
}

function MetricList({ metrics, extra }: { metrics: Metric[]; extra?: ReactNode }) {
  return (
    <dl className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-6">
      {metrics.map((m) => (
        <div key={m.label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">{m.label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">{m.value}</dd>
          {m.note && <dd className="text-xs tabular-nums text-muted">{m.note}</dd>}
        </div>
      ))}
      {extra}
    </dl>
  );
}
