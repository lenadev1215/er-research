import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { callErApi, type ErApiBody } from "@/lib/er-api/client";
import type { Pick } from "@/lib/synergy-aggregate";
import { groupWeaponCode, groupedWeapon } from "@/lib/weapon-groups";
import type { RecentRecord } from "./recent-games";

// 랭크 스쿼드 판의 팀원 2명과 팀 딜량. DB에 이미 있는 경기는 DB에서 읽고, 없는 경기만 상세 조회한다.
// 상세 조회는 1판에 1회(1.1초)라 최신 판부터 DETAIL_LIMIT판까지만 부른다.
const DETAIL_LIMIT = 6;

type GameDetail = ErApiBody & {
  userGames?: { teamNumber: number; characterNum: number; bestWeapon: number; damageToPlayer?: number }[];
};

type TeamRow = Pick & { damage: number | null };

// 팀원 2명과 팀 딜량 합. 팀원 딜량이 하나라도 비어 있으면(0004 이전 수집분) 딜량은 null.
export type TeamInfo = { mates: [ Pick, Pick ]; damage: number | null };

// 같은 팀 안에서 실험체는 겹치지 않으므로 내 실험체 코드로 나를 뺀다 (scripts/backfill.mts와 같은 규칙).
// 내 딜량은 경기 목록 값으로 바꿔 더한다.
const teamFrom = (team: TeamRow[], me: RecentRecord): TeamInfo | null => {
  const mates = team.filter((p) => p.characterCode !== me.characterCode);
  if ( mates.length !== 2 ) return null;
  const [ a, b ] = mates;
  return {
    mates: [ { characterCode: a.characterCode, weaponCode: a.weaponCode }, { characterCode: b.characterCode, weaponCode: b.weaponCode } ],
    damage: a.damage === null || b.damage === null ? null : me.damage + a.damage + b.damage,
  };
};

function teamFromDb(record: RecentRecord): TeamInfo | null {
  const team = db
    .select({ characterCode: participants.characterCode, weaponCode: groupedWeapon(participants), damage: participants.damageToPlayer })
    .from(participants)
    .where(and(eq(participants.gameId, record.gameId), eq(participants.teamNumber, record.teamNumber)))
    .all();
  return team.length === 3 ? teamFrom(team, record) : null;
}

async function teamFromApi(record: RecentRecord, signal: AbortSignal): Promise<TeamInfo | null> {
  const detail = await callErApi<GameDetail>("game", `/v1/games/${ record.gameId }`, { signal });
  const team = ( detail?.userGames ?? [] )
    .filter((u) => u.teamNumber === record.teamNumber)
    .map((u) => ({ characterCode: u.characterNum, weaponCode: groupWeaponCode(u.characterNum, u.bestWeapon), damage: u.damageToPlayer ?? null }));
  return teamFrom(team, record);
}

// 최신 판부터 받은 records 순서를 그대로 쓴다. 키는 records의 인덱스.
export async function findTeammates(records: RecentRecord[], signal: AbortSignal): Promise<Map<number, TeamInfo>> {
  const result = new Map<number, TeamInfo>();
  let detailCalls = 0;
  for ( const [ i, record ] of records.entries() ) {
    if ( record.mode !== "rankSquad" ) continue;
    const fromDb = teamFromDb(record);
    if ( fromDb ) {
      result.set(i, fromDb);
      continue;
    }
    if ( detailCalls >= DETAIL_LIMIT ) continue;
    detailCalls++;
    const fromApi = await teamFromApi(record, signal);
    if ( fromApi ) result.set(i, fromApi);
  }
  return result;
}
