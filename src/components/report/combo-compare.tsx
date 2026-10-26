"use client";

import type { ComboComparison } from "@/lib/report/types";
import { percent } from "@/components/synergy/format";
import { PickBadge, PickGroup } from "@/components/synergy/pick-badge";
import { DbTier, DeltaCell, roundDiff } from "./compare-cells";

// 랭크 스쿼드 판에서 함께한 팀원 2명 조합을 DB 조합 등급과 비교한다.
export function ComboCompare({ combos }: { combos: ComboComparison[] }) {
  return (
    <section aria-labelledby="combo-compare-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="combo-compare-heading" className="text-sm font-semibold text-ink">팀원 조합 비교</h2>
        <p className="text-xs text-muted">랭크 스쿼드 판만 비교합니다.</p>
      </div>
      {combos.length === 0 ? (
        <p className="rounded-md bg-surface px-5 py-6 text-sm text-muted">
          최근 경기에 랭크 스쿼드 판이 없어 팀원 조합을 비교하지 않았습니다.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md bg-surface">
          {combos.map(({ pick, mates, me, db }) => {
            // 등급을 못 매길 만큼 DB 판수가 적으면 평균도 비교 기준으로 쓰지 않는다.
            const ref = db?.tier ? db : null;
            const emptyText = db ? `표본 ${ db.games }판` : "평균 없음";
            return (
              <li
                key={`${ pick.characterCode }:${ pick.weaponCode }|${ mates.map((m) => `${ m.characterCode }:${ m.weaponCode }`).join("+") }`}
                className="grid items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-5 lg:grid-cols-[30rem_1fr]"
              >
                {/* 좁은 화면: [등급 · 내 실험체 · 판수] 아래 줄에 [팀원 2명]. 넓은 화면은 한 줄. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <DbTier tier={db?.tier ?? null} hasDb={db !== null} />
                  <PickBadge pick={pick} variant="inline" />
                  <span className="text-sm tabular-nums text-muted sm:order-last">{me.games}판</span>
                  <span className="flex w-full items-center gap-3 sm:w-auto">
                    <span className="text-xs text-muted">팀원</span>
                    <PickGroup mates={mates} variant="inline" />
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-5 sm:max-w-xs">
                  <DeltaCell
                    label="TOP3율"
                    value={percent(me.top3Rate)}
                    dbValue={ref ? percent(ref.top3Rate) : null}
                    diff={ref ? roundDiff(me.top3Rate - ref.top3Rate, 3) : null}
                    higherIsBetter
                    emptyText={emptyText}
                  />
                  <DeltaCell
                    label="평균 순위"
                    value={me.avgRank.toFixed(1)}
                    dbValue={ref ? ref.avgRank.toFixed(1) : null}
                    diff={ref ? roundDiff(me.avgRank - ref.avgRank, 1) : null}
                    higherIsBetter={false}
                    emptyText={emptyText}
                  />
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
