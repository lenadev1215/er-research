import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, participants } from "@/db/schema";
import type { Stats, SynergyCombo } from "./synergy-aggregate";
import { assignTiers, type Tier } from "./tier";
import { groupedWeapon } from "./weapon-groups";

// 실험체 티어: 실험체+무기 단위로 전체 실험체·무기와 비교한다. 핵심 특성은 나누지 않는다 (표본 희석 방지).
// 계산 방식은 팀원 조합 등급과 같다 (표본 보정 → 종합 점수 → 백분위).
const PICK_MIN_GAMES = 20;

export type PickStats = Stats & { avgDamage: number | null };

export type PickTierResponse = {
  stats: PickStats;
  tier: Tier | null; // 판수가 최소 기준 미만이면 null (표본 부족)
  rank: number | null; // 등급 순위 (1부터)
  rankedCount: number; // 등급을 매긴 실험체·무기 수
  minGames: number;
};

const key = (characterCode: number, weaponCode: number) => `${ characterCode }:${ weaponCode }`;

// 참가자 한 명 = 한 판. 순위·TK는 팀 값, RP·딜량은 본인 값이다.
function aggregatePicks(): Map<string, PickStats> {
  const weapon = groupedWeapon(participants);
  const rows = db
    .select({
      characterCode: participants.characterCode,
      weaponCode: weapon,
      games: sql<number>`count(*)`,
      wins: sql<number>`sum(${ participants.gameRank } = 1)`,
      top3: sql<number>`sum(${ participants.gameRank } <= 3)`,
      rpSum: sql<number>`sum(${ participants.mmrGain })`,
      rankSum: sql<number>`sum(${ participants.gameRank })`,
      tkGames: sql<number>`count(${ participants.teamKill })`,
      tkSum: sql<number>`coalesce(sum(${ participants.teamKill }), 0)`,
      damageGames: sql<number>`count(${ participants.damageToPlayer })`,
      damageSum: sql<number>`coalesce(sum(${ participants.damageToPlayer }), 0)`,
      baselineSum: sql<number>`sum(1.0 / ${ games.teamCount })`,
    })
    .from(participants)
    .innerJoin(games, eq(games.id, participants.gameId))
    .groupBy(participants.characterCode, weapon)
    .all();

  return new Map(rows.map((r) => [ key(r.characterCode, r.weaponCode), {
    games: r.games,
    winRate: r.wins / r.games,
    top3Rate: r.top3 / r.games,
    avgRp: r.rpSum / r.games,
    avgRank: r.rankSum / r.games,
    avgTk: r.tkGames ? r.tkSum / r.tkGames : null,
    avgDamage: r.damageGames ? r.damageSum / r.damageGames : null,
    baselineWinRate: r.baselineSum / r.games,
  } ]));
}

export function getPickTier(characterCode: number, weaponCode: number): PickTierResponse | null {
  const all = aggregatePicks();
  const stats = all.get(key(characterCode, weaponCode));
  if ( !stats ) return null;

  // assignTiers는 조합 형태를 받으므로 팀원 없는 조합으로 감싼다.
  const combos: SynergyCombo[] = [ ...all ].map(([ k, s ]) => ({ ...s, key: k, mates: [] }));
  const { ranked } = assignTiers(combos, "overall", PICK_MIN_GAMES);
  const index = ranked.findIndex((c) => c.key === key(characterCode, weaponCode));

  return {
    stats,
    tier: index >= 0 ? ranked[ index ].tier : null,
    rank: index >= 0 ? index + 1 : null,
    rankedCount: ranked.length,
    minGames: PICK_MIN_GAMES,
  };
}
