"use client";

import type { PickComparison } from "@/lib/report/types";
import { damage, percent } from "@/components/synergy/format";
import { PickBadge } from "@/components/synergy/pick-badge";
import { DbTier, DeltaCell, roundDiff } from "./compare-cells";

// 최근 경기에서 쓴 실험체·무기를 DB(랭크 스쿼드, 다이아몬드 이상) 평균과 비교한다.
export function PickCompare({ picks }: { picks: PickComparison[] }) {
  return (
    <section aria-labelledby="pick-compare-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="pick-compare-heading" className="text-sm font-semibold text-ink">실험체별 비교</h2>
        <p className="text-xs text-muted">평균은 수집 데이터(다이아몬드 이상 랭크 스쿼드) 기준입니다. 참고 표시는 일반 경기가 섞여 그대로 비교하기 어려운 항목입니다.</p>
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-md bg-surface">
        {picks.map(({ pick, me, db, basis }) => (
          <li key={`${ pick.characterCode }:${ pick.weaponCode }`} className="grid items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-5 md:grid-cols-[15rem_1fr]">
            <div className="flex items-center gap-3">
              <DbTier tier={db?.tier ?? null} hasDb={db !== null} />
              <PickBadge pick={pick} variant="inline" />
              <span className="text-sm tabular-nums text-muted">{me.games}판</span>
              {basis === "reference" && (
                <span title="일반 경기 등이 섞여 있어 랭크 스쿼드 데이터와 그대로 비교하기 어렵습니다" className="rounded bg-rail px-1.5 py-0.5 text-[11px] text-muted">
                  참고
                </span>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
              <DeltaCell
                label="TOP3율"
                value={percent(me.top3Rate)}
                dbValue={db ? percent(db.top3Rate) : null}
                diff={db ? roundDiff(me.top3Rate - db.top3Rate, 3) : null}
                higherIsBetter
              />
              <DeltaCell
                label="평균 순위"
                value={me.avgRank.toFixed(1)}
                dbValue={db ? db.avgRank.toFixed(1) : null}
                diff={db ? roundDiff(me.avgRank - db.avgRank, 1) : null}
                higherIsBetter={false}
              />
              <DeltaCell
                label="평균 딜량"
                value={damage(me.avgDamage)}
                dbValue={db?.avgDamage == null ? null : damage(db.avgDamage)}
                diff={db?.avgDamage == null ? null : roundDiff(me.avgDamage - db.avgDamage, 0)}
                higherIsBetter
              />
              {/* 시야 점수: 기준 50. 이전 형식의 고정 데이터에는 값이 없을 수 있어 == null로 함께 거른다. */}
              <DeltaCell
                label="시야 점수"
                value={me.visionScore == null ? "-" : me.visionScore.toFixed(0)}
                dbValue={db?.visionScore == null ? null : db.visionScore.toFixed(0)}
                diff={me.visionScore == null || db?.visionScore == null ? null : roundDiff(me.visionScore - db.visionScore, 0)}
                higherIsBetter
              />
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
