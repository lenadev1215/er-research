import type { ImpactSummary, MyMetrics, ReportTeam, ReportVision, TeamRole } from "@/lib/report/types";
import { damage, percent, signedRp } from "@/components/synergy/format";

type Metric = { label: string; value: string; note?: string | null };

const ROLE_LABEL: Record<TeamRole, string> = {
  kill: "킬 캐치",
  damage: "딜 담당",
  balanced: "균형",
};

// 최근 경기 전체 지표를 한 줄로. RP는 랭크 경기만으로 낸 값이다.
// 시야 점수는 기준 50이고, 아래에 같은 실험체를 쓴 수집 데이터의 평균을 붙인다.
// 팀 기여는 둘째 줄. 딜 점유율은 팀 정보가 있는 판으로만 낸다.
export function ReportSummary({ overall, vision, team, impact }: { overall: MyMetrics; vision: ReportVision; team: ReportTeam | undefined; impact: ImpactSummary | undefined }) {
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
      {team && <TeamRow team={team} impact={impact} />}
    </div>
  );
}

// 캐리·버스는 TOP3 판 중 같은 실험체 평균과 비교해 판정한 판수다.
function TeamRow({ team, impact }: { team: ReportTeam; impact: ImpactSummary | undefined }) {
  const { me, ref } = team;
  const share = (v: number | null | undefined) => ( v == null ? "-" : percent(v) );
  const refNote = (v: number | null | undefined, format: (x: number) => string) => ( v == null ? null : `같은 실험체 평균 ${ format(v) }` );
  const metrics: Metric[] = [
    { label: "팀 내 역할", value: team.role === null ? "-" : ROLE_LABEL[ team.role ], note: team.role === null ? "팀 정보가 있는 판이 없습니다" : null },
    { label: "평균 TK", value: me.teamKill.toFixed(1), note: refNote(ref?.teamKill, (x) => x.toFixed(1)) },
    { label: "킬 점유율", value: share(me.killShare), note: refNote(ref?.killShare, percent) },
    { label: "킬 관여율", value: share(me.involvement), note: refNote(ref?.involvement, percent) },
    {
      label: `딜 점유율 (${ me.damageGames }판)`,
      value: share(me.damageShare),
      note: refNote(ref?.damageShare, percent),
    },
    ...( impact ? [
      { label: "캐리한 판", value: `${ impact.carry }판`, note: `TOP3 ${ impact.top3 }판 중` },
      { label: "버스 탄 판", value: `${ impact.bus }판`, note: `TOP3 ${ impact.top3 }판 중` },
    ] : [] ),
  ];

  return (
    <section aria-labelledby="team-heading" className="flex flex-col gap-3">
      <h3 id="team-heading" className="text-xs font-semibold text-ink">팀 기여</h3>
      <MetricList metrics={metrics} />
    </section>
  );
}

function MetricList({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-6">
      {metrics.map((m) => (
        <div key={m.label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted">{m.label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">{m.value}</dd>
          {m.note && <dd className="text-xs tabular-nums text-muted">{m.note}</dd>}
        </div>
      ))}
    </dl>
  );
}
