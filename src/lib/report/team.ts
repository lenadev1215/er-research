import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { groupedWeapon } from "@/lib/weapon-groups";
import type { TeamMetrics, TeamRole } from "./types";

// 팀 기여: TK(팀 킬), 킬 점유율(내 킬 / TK), 킬 관여율((킬 + 어시스트) / TK), 딜 점유율(내 딜량 / 팀 딜량).
// 비율은 KDA처럼 판별 비율의 평균이 아니라 합의 비율로 낸다 (TK가 작은 한 판에 덜 휘둘린다).
// 딜 점유율은 팀원 딜량이 필요해 팀 정보가 있는 판(DB 랭크 판, 상세 조회한 판)으로만 낸다.

const PICK_MIN_ROWS = 20; // 실험체·무기별 DB 평균의 최소 표본 (실험체 티어와 같은 기준)
const TEAM_SHARE = 1 / 3; // 3인 팀이 고르게 나눴을 때의 점유율
const DAMAGE_MARGIN = 0.03; // 딜 점유율이 같은 실험체 평균보다 이 폭(3%p) 이상 높으면 딜 담당 (사용자 결정)
const KILL_MARGIN = 0.05; // 킬 점유율이 이 폭(5%p) 이상 높으면 킬 캐치 (사용자 결정)

export type TeamSample = { kills: number; assists: number; teamKill: number; damage: number; teamDamage: number | null };

// 표본의 합으로 지표를 낸다. TK 합이 0이면 비율은 null.
export function toTeamMetrics(samples: TeamSample[]): TeamMetrics | null {
  if ( samples.length === 0 ) return null;
  const sum = (pick: (s: TeamSample) => number) => samples.reduce((acc, s) => acc + pick(s), 0);
  const tk = sum((s) => s.teamKill);
  const withDamage = samples.filter((s) => s.teamDamage !== null && s.teamDamage > 0);
  const teamDamage = withDamage.reduce((acc, s) => acc + ( s.teamDamage ?? 0 ), 0);
  return {
    games: samples.length,
    teamKill: tk / samples.length,
    killShare: tk > 0 ? sum((s) => s.kills) / tk : null,
    involvement: tk > 0 ? sum((s) => s.kills + s.assists) / tk : null,
    damageGames: withDamage.length,
    damageShare: teamDamage > 0 ? withDamage.reduce((acc, s) => acc + s.damage, 0) / teamDamage : null,
  };
}

// 딜 점유율이 높으면 킬과 상관없이 딜 담당, 아니고 킬 점유율이 높으면 킬 캐치, 둘 다 아니면 균형 (사용자 결정).
// 기준(ref)이 있으면 같은 실험체 평균 대비 우위로 본다 (딜러 실험체는 둘 다 높게 나오므로).
// 기준이 없으면 3인 팀 기준선(1/3)과 비교한다.
export function teamRole(me: TeamMetrics, ref: TeamMetrics | null): TeamRole | null {
  if ( me.killShare === null || me.damageShare === null ) return null;
  const useRef = ref?.killShare != null && ref.damageShare != null;
  const killEdge = me.killShare - ( useRef ? ref.killShare ?? 0 : TEAM_SHARE );
  const damageEdge = me.damageShare - ( useRef ? ref.damageShare ?? 0 : TEAM_SHARE );
  if ( damageEdge >= DAMAGE_MARGIN ) return "damage";
  if ( killEdge >= KILL_MARGIN ) return "kill";
  return "balanced";
}

// 실험체·무기별 DB 평균. 표본 부족이면 null.
export function loadTeamBaseline(): (characterCode: number, weaponCode: number) => TeamMetrics | null {
  const weapon = groupedWeapon(participants);
  // 같은 경기·같은 팀의 딜량 합. participants_game_team_idx를 탄다.
  const teamDamage = sql<number>`(select sum(t.damage_to_player) from participants t where t.game_id = ${ participants.gameId } and t.team_number = ${ participants.teamNumber })`;
  const rows = db
    .select({
      characterCode: participants.characterCode,
      weaponCode: weapon,
      rows: sql<number>`count(*)`,
      kills: sql<number>`sum(${ participants.playerKill })`,
      assists: sql<number>`sum(${ participants.playerAssistant })`,
      teamKill: sql<number>`sum(${ participants.teamKill })`,
      damage: sql<number>`sum(${ participants.damageToPlayer })`,
      teamDamage: sql<number>`sum(${ teamDamage })`,
    })
    .from(participants)
    .where(sql`${ participants.playerKill } is not null and ${ participants.teamKill } is not null and ${ participants.damageToPlayer } is not null`)
    .groupBy(participants.characterCode, weapon)
    .all();

  const byPick = new Map(rows
    .filter((r) => r.rows >= PICK_MIN_ROWS)
    .map((r) => [ `${ r.characterCode }:${ r.weaponCode }`, {
      games: r.rows,
      teamKill: r.teamKill / r.rows,
      killShare: r.teamKill > 0 ? r.kills / r.teamKill : null,
      involvement: r.teamKill > 0 ? ( r.kills + r.assists ) / r.teamKill : null,
      damageGames: r.rows,
      damageShare: r.teamDamage > 0 ? r.damage / r.teamDamage : null,
    } satisfies TeamMetrics ]));

  return (characterCode, weaponCode) => byPick.get(`${ characterCode }:${ weaponCode }`) ?? null;
}
