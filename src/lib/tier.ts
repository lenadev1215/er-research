// 티어 산정 (순수 함수). 서버는 조합별 통계만 내려주고, 기준 전환은 클라이언트에서 즉시 다시 계산한다.
import type { SynergyCombo } from "./synergy-aggregate";

export const TIERS = [ "S", "A", "B", "C", "D" ] as const;
export type Tier = (typeof TIERS)[ number ];

export type Criterion = "overall" | "winRate" | "rp" | "games";

export const CRITERION_LABELS: Record<Criterion, string> = {
  overall: "종합",
  winRate: "승률",
  rp: "RP",
  games: "판수",
};

// 종합 점수 가중치 (초안). 가라데이터·실데이터를 보며 조정한다.
const OVERALL_WEIGHTS = { winRate: 0.3, top3Rate: 0.2, avgRp: 0.35, games: 0.15 };

// 상위 누적 백분위 경계: S 10%, A 25%, B 50%, C 75%, 나머지 D
const TIER_CUTOFFS: ReadonlyArray<[ Tier, number ]> = [ [ "S", 0.1 ], [ "A", 0.25 ], [ "B", 0.5 ], [ "C", 0.75 ] ];

export type RankedCombo = SynergyCombo & { score: number; tier: Tier };

export type TierResult = {
  ranked: RankedCombo[]; // 점수 내림차순
  byTier: Record<Tier, RankedCombo[]>;
  insufficient: SynergyCombo[];
};

function normalizer(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
}

function scorer(combos: SynergyCombo[], criterion: Criterion): (c: SynergyCombo) => number {
  if ( criterion === "winRate" ) return (c) => c.winRate;
  if ( criterion === "rp" ) return (c) => c.avgRp;
  if ( criterion === "games" ) return (c) => c.games;

  const win = normalizer(combos.map((c) => c.winRate));
  const top3 = normalizer(combos.map((c) => c.top3Rate));
  const rp = normalizer(combos.map((c) => c.avgRp));
  const games = normalizer(combos.map((c) => Math.log(c.games)));
  return (c) =>
    OVERALL_WEIGHTS.winRate * win(c.winRate) +
    OVERALL_WEIGHTS.top3Rate * top3(c.top3Rate) +
    OVERALL_WEIGHTS.avgRp * rp(c.avgRp) +
    OVERALL_WEIGHTS.games * games(Math.log(c.games));
}

const tierAt = (index: number, total: number): Tier =>
  TIER_CUTOFFS.find(([ , cutoff ]) => index / total < cutoff)?.[ 0 ] ?? "D";

export function assignTiers(combos: SynergyCombo[], criterion: Criterion, minGames: number): TierResult {
  const eligible = combos.filter((c) => c.games >= minGames);
  const insufficient = combos.filter((c) => c.games < minGames);
  const score = scorer(eligible, criterion);

  const ranked = eligible
    .map((c) => ({ ...c, score: score(c) }))
    .sort((x, y) => y.score - x.score || y.games - x.games)
    .map((c, i, all) => ({ ...c, tier: tierAt(i, all.length) }));

  const byTier = Object.fromEntries(TIERS.map((t) => [ t, ranked.filter((c) => c.tier === t) ])) as Record<Tier, RankedCombo[]>;
  return { ranked, byTier, insufficient };
}
