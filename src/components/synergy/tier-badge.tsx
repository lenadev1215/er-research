import type { Tier } from "@/lib/tier";

// 등급 농도: S가 가장 진한 VF 보라, D로 갈수록 회색
const TIER_BADGE: Record<Tier, string> = {
  S: "bg-tier-s text-white",
  A: "bg-tier-a text-white",
  B: "bg-tier-b text-ink",
  C: "bg-tier-c text-ink",
  D: "bg-tier-d text-muted",
};

// 데스크톱은 정사각 배지, 모바일은 행 높이만큼 세로로 긴 띠
export function TierBadge({ tier, tall = false }: { tier: Tier; tall?: boolean }) {
  return (
    <span
      aria-label={`${ tier } 등급`}
      className={`inline-flex shrink-0 items-center justify-center rounded font-display text-xl leading-none font-extrabold ${
        tall ? "w-8 self-stretch" : "h-8 w-8"
      } ${ TIER_BADGE[ tier ] }`}
    >
      {tier}
    </span>
  );
}
