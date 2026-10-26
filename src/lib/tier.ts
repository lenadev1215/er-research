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

// 종합 점수 가중치 (초안). 실데이터를 보며 조정한다.
// 표본 보정이 "믿을 만한가"를 맡고, games 가중치는 "많이 쓰이는가"를 맡는다.
const OVERALL_WEIGHTS = { winRate: 0.3, top3Rate: 0.2, avgRp: 0.35, games: 0.15 };

// 표본 보정 세기: 가상의 평균 성적 경기 K판을 더한 것처럼 계산한다.
// 판수가 K보다 훨씬 적으면 평균에 가깝게, 훨씬 많으면 실제 값에 가깝게 된다.
const SHRINK_GAMES = 10;

// 상위 누적 백분위 경계: S 10%, A 25%, B 50%, C 75%, 나머지 D
const TIER_CUTOFFS: ReadonlyArray<[ Tier, number ]> = [ [ "S", 0.1 ], [ "A", 0.25 ], [ "B", 0.5 ], [ "C", 0.75 ] ];

// 백분위는 상대 순위라 거의 모든 조합이 1~3판이면 그중에서 S가 나온다.
// 종합 등급에 한해 판수가 적은 조합은 절대 기준으로 상한을 둔다. 판수가 적은 구간부터 적는다.
// 3판 이하는 최고 B, 4~9판은 최고 A. S는 10판 이상만 받는다.
const LOW_SAMPLE_CAPS: ReadonlyArray<{ maxGames: number; cap: Tier }> = [
  { maxGames: 3, cap: "B" },
  { maxGames: 9, cap: "A" },
];

const tierIndex = (tier: Tier) => TIERS.indexOf(tier);

const capTier = (tier: Tier, games: number): Tier => {
  const cap = LOW_SAMPLE_CAPS.find((c) => games <= c.maxGames)?.cap;
  return cap !== undefined && tierIndex(tier) < tierIndex(cap) ? cap : tier;
};

// 등급 순서: 등급이 먼저, 같은 등급 안에서는 점수. 상한이 걸린 조합이 점수로 위 등급보다 앞서지 않게 한다.
export const compareRank = (x: RankedCombo, y: RankedCombo) =>
  tierIndex(x.tier) - tierIndex(y.tier) || y.score - x.score || y.games - x.games;

export type RankedCombo = SynergyCombo & { score: number; tier: Tier };

export type TierResult = {
  ranked: RankedCombo[]; // 등급 순, 같은 등급은 점수 내림차순
  byTier: Record<Tier, RankedCombo[]>;
  insufficient: SynergyCombo[];
};

function normalizer(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
}

type Shrunk = { winRate: number; top3Rate: number; avgRp: number };

// 베이지안 보정: (합계 + K × 평균) / (판수 + K). 평균은 조회 결과 전체를 판수로 가중한 값.
// 1판 100% 같은 우연한 기록이 상위 등급을 차지하지 않게 한다. 표에는 원래 값을 보여준다.
function shrinker(all: SynergyCombo[]): (c: SynergyCombo) => Shrunk {
  const totalGames = all.reduce((sum, c) => sum + c.games, 0);
  const mean = (pick: (c: SynergyCombo) => number) =>
    totalGames === 0 ? 0 : all.reduce((sum, c) => sum + pick(c) * c.games, 0) / totalGames;
  const prior = { winRate: mean((c) => c.winRate), top3Rate: mean((c) => c.top3Rate), avgRp: mean((c) => c.avgRp) };
  const shrink = (value: number, games: number, priorValue: number) =>
    (value * games + SHRINK_GAMES * priorValue) / (games + SHRINK_GAMES);

  return (c) => ({
    winRate: shrink(c.winRate, c.games, prior.winRate),
    top3Rate: shrink(c.top3Rate, c.games, prior.top3Rate),
    avgRp: shrink(c.avgRp, c.games, prior.avgRp),
  });
}

function scorer(eligible: SynergyCombo[], all: SynergyCombo[], criterion: Criterion): (c: SynergyCombo) => number {
  if ( criterion === "games" ) return (c) => c.games;

  const adjusted = shrinker(all);
  if ( criterion === "winRate" ) return (c) => adjusted(c).winRate;
  if ( criterion === "rp" ) return (c) => adjusted(c).avgRp;

  const values = eligible.map((c) => ({ ...adjusted(c), logGames: Math.log(c.games) }));
  const win = normalizer(values.map((v) => v.winRate));
  const top3 = normalizer(values.map((v) => v.top3Rate));
  const rp = normalizer(values.map((v) => v.avgRp));
  const games = normalizer(values.map((v) => v.logGames));
  return (c) => {
    const v = adjusted(c);
    return OVERALL_WEIGHTS.winRate * win(v.winRate) +
      OVERALL_WEIGHTS.top3Rate * top3(v.top3Rate) +
      OVERALL_WEIGHTS.avgRp * rp(v.avgRp) +
      OVERALL_WEIGHTS.games * games(Math.log(c.games));
  };
}

const tierAt = (index: number, total: number): Tier =>
  TIER_CUTOFFS.find(([ , cutoff ]) => index / total < cutoff)?.[ 0 ] ?? "D";

export function assignTiers(combos: SynergyCombo[], criterion: Criterion, minGames: number): TierResult {
  const eligible = combos.filter((c) => c.games >= minGames);
  const insufficient = combos.filter((c) => c.games < minGames);
  const score = scorer(eligible, combos, criterion);

  const ranked = eligible
    .map((c) => ({ ...c, score: score(c) }))
    .sort((x, y) => y.score - x.score || y.games - x.games)
    .map((c, i, all) => {
      const tier = tierAt(i, all.length);
      return { ...c, tier: criterion === "overall" ? capTier(tier, c.games) : tier };
    })
    .sort(compareRank);

  const byTier = Object.fromEntries(TIERS.map((t) => [ t, ranked.filter((c) => c.tier === t) ])) as Record<Tier, RankedCombo[]>;
  return { ranked, byTier, insufficient };
}
