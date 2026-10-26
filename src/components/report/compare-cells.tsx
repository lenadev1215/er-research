import type { Tier } from "@/lib/tier";
import { TierBadge } from "@/components/synergy/tier-badge";

type DeltaProps = {
  label: string;
  value: string;
  dbValue: string | null;
  diff: number | null; // 표시 단위로 반올림한 (내 값 − DB 값). DB 값이 없으면 null
  higherIsBetter: boolean;
  emptyText?: string; // dbValue가 없을 때 대신 보여줄 문구
};

// 내 값을 크게, DB 평균을 작게 붙인다. 색은 SynergySummary와 같은 규칙 (좋으면 VF, 나쁘면 alert).
export function DeltaCell({ label, value, dbValue, diff, higherIsBetter, emptyText = "평균 없음" }: DeltaProps) {
  const tone = diff === null || diff === 0 ? "text-muted" : ( diff > 0 ) === higherIsBetter ? "text-vf" : "text-alert";
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-[15px] font-medium tabular-nums text-ink">{value}</dd>
      <dd className={`text-xs tabular-nums ${ tone }`}>{dbValue === null ? emptyText : `평균 ${ dbValue }`}</dd>
    </div>
  );
}

// DB 등급. 기록이 없거나 표본이 부족하면 같은 크기의 빈 칸으로 자리를 맞춘다.
export function DbTier({ tier, hasDb }: { tier: Tier | null; hasDb: boolean }) {
  if ( tier ) return <TierBadge tier={tier} />;
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-dashed border-line text-[10px] leading-tight text-muted">
      {hasDb ? "표본 부족" : "없음"}
    </span>
  );
}

// -0을 0으로 정리한다.
export const roundDiff = (v: number, digits: number) => {
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return r === 0 ? 0 : r;
};
