"use client";

import { TIERS, type Criterion, type Tier, type TierResult } from "@/lib/tier";
import { signedRp } from "./format";
import { PickPair } from "./pick-badge";

// 등급 농도: S가 가장 진한 VF 보라, D로 갈수록 회색
const RAIL_STYLE: Record<Tier, string> = {
  S: "bg-tier-s text-white",
  A: "bg-tier-a text-white",
  B: "bg-tier-b text-ink",
  C: "bg-tier-c text-ink",
  D: "bg-tier-d text-muted",
};

type Props = { result: TierResult; criterion: Criterion };

export function TierBoard({ result, criterion }: Props) {
  if ( result.ranked.length === 0 ) {
    return (
      <p className="rounded-md bg-surface px-5 py-8 text-sm text-muted">
        최소 판수를 넘는 조합이 없습니다. 최소 판수를 낮추면 판정할 수 있습니다.
      </p>
    );
  }

  return (
    <ol aria-label="팀원 조합 등급" className="overflow-hidden rounded-md bg-surface">
      {TIERS.map((tier) => {
        const combos = result.byTier[ tier ];
        if ( combos.length === 0 ) return null;
        return (
          <li key={tier} className="grid grid-cols-[3.5rem_1fr] border-b border-line last:border-b-0 sm:grid-cols-[5rem_1fr]">
            <div className={`flex items-start justify-center pt-3 ${ RAIL_STYLE[ tier ] }`}>
              <span className="font-display text-5xl leading-none font-extrabold sm:text-6xl" aria-label={`${ tier } 등급`}>
                {tier}
              </span>
            </div>
            <ul className="flex flex-wrap gap-x-7 gap-y-4 px-4 py-4 sm:px-5">
              {combos.map((c) => (
                // 기준이 바뀌면 다시 마운트되어 정착 모션이 한 번 재생된다
                <li key={`${ criterion }:${ c.key }`} className="animate-settle flex items-start gap-2.5">
                  <PickPair mates={c.mates} />
                  <span className="mt-2.5 flex flex-col whitespace-nowrap text-sm leading-tight tabular-nums text-muted">
                    <span className={`font-medium ${ c.avgRp < 0 ? "text-alert" : "text-vf" }`}>{signedRp(c.avgRp)} RP</span>
                    <span>{c.games}판</span>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
