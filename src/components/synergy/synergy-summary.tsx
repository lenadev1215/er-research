"use client";

import type { Stats } from "@/lib/synergy-aggregate";
import { percent, signedRp } from "./format";

type Props = { team: Stats; baseline: Stats };

type Metric = {
  label: string;
  value: string;
  diff: number; // 표시 단위로 반올림한 차이
  unit: string;
  digits: number;
  higherIsBetter: boolean;
};

// 팀원 2명을 모두 고른 경우: 그 3인 조합의 성적을 내 실험체 전체 평균과 비교한다.
export function SynergySummary({ team, baseline }: Props) {
  const metrics: Metric[] = [
    { label: "1위율", value: percent(team.winRate), diff: round((team.winRate - baseline.winRate) * 100, 1), unit: "%p", digits: 1, higherIsBetter: true },
    { label: "TOP3율", value: percent(team.top3Rate), diff: round((team.top3Rate - baseline.top3Rate) * 100, 1), unit: "%p", digits: 1, higherIsBetter: true },
    { label: "평균 RP", value: signedRp(team.avgRp), diff: round(team.avgRp - baseline.avgRp, 1), unit: "", digits: 1, higherIsBetter: true },
    { label: "평균 순위", value: team.avgRank.toFixed(1), diff: round(team.avgRank - baseline.avgRank, 1), unit: "", digits: 1, higherIsBetter: false },
  ];

  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-4 rounded-md bg-surface p-5 sm:p-6">
      <h2 id="summary-heading" className="text-lg font-semibold text-ink">
        이 조합으로 {team.games}판
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {metrics.map((m) => {
          // 반올림 후 0이면 차이 없음으로 본다 (-0.0에 색이 붙지 않게).
          const tone = m.diff === 0 ? "text-muted" : ( m.diff > 0 ) === m.higherIsBetter ? "text-vf" : "text-alert";
          const sign = m.diff > 0 ? "+" : m.diff < 0 ? "" : "±";
          return (
            <div key={m.label} className="flex flex-col gap-1">
              <dt className="text-sm text-muted">{m.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-ink">{m.value}</dd>
              <dd className={`text-sm tabular-nums ${ tone }`}>
                평균 대비 {sign}{Math.abs(m.diff) === 0 ? (0).toFixed(m.digits) : m.diff.toFixed(m.digits)}{m.unit}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="text-sm text-muted">
        평균은 이 실험체·무기·특성으로 치른 전체 {baseline.games}판 기준입니다.
        {team.games < 10 && " 판수가 적어 우연의 영향이 큽니다."}
      </p>
    </section>
  );
}

// -0을 0으로 정리한다.
const round = (v: number, digits: number) => {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return r === 0 ? 0 : r;
};
