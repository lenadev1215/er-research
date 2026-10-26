import "server-only";
import { callErApi, ErApiBusyError, type ErApiBody } from "@/lib/er-api/client";
import { groupWeaponCode } from "@/lib/weapon-groups";
import type { ReportMode, VisionMetrics } from "./types";

// 닉네임 → 최근 경기 (코발트 제외). gameId·teamNumber는 팀원 조회에만 쓰고 응답 밖으로 내보내지 않는다.

export const RECENT_COUNT = 20;
const MAX_PAGES = 4; // 페이지당 10판. 코발트가 많아도 40판까지만 본다

// 확인된 값: matchingMode 2 = 일반, 3 = 랭크, matchingTeamMode 3 = 스쿼드 (docs/API_NOTES.md)
// 코발트(6 / 4)는 미확인 추정값이다. 둘 중 하나만 맞아도 뺀다.
const COBALT_MATCHING_MODE = 6;
const COBALT_TEAM_MODE = 4;

type UserGameRecord = {
  gameId: number;
  seasonId: number; // 일반 경기는 0
  matchingMode: number;
  matchingTeamMode: number;
  matchSize: number;
  teamNumber: number;
  gameRank: number;
  characterNum: number;
  bestWeapon: number;
  mmrBefore?: number; // 일반 경기에는 없다
  mmrGain?: number;
  damageToPlayer: number;
  viewContribution?: number;
  addTelephotoCamera?: number;
  removeTelephotoCamera?: number;
  useReconDrone?: number;
  playerKill?: number;
  playerAssistant?: number;
  playerDeaths?: number;
  teamKill?: number;
};

export type RecentRecord = {
  gameId: number;
  teamNumber: number;
  mode: ReportMode;
  rank: number;
  teams: number;
  rp: number | null;
  mmrBefore: number | null;
  damage: number;
  characterCode: number;
  weaponCode: number; // 묶음 규칙 적용 후
  vision: VisionMetrics;
  kills: number;
  assists: number;
  deaths: number;
  teamKill: number;
  teamDamage: number | null; // 팀 딜량 합. 경기 목록에는 팀원 정보가 없어 findTeammates가 채운다
};

const isCobalt = (g: UserGameRecord) => g.matchingMode === COBALT_MATCHING_MODE || g.matchingTeamMode === COBALT_TEAM_MODE;

function modeOf(g: UserGameRecord): ReportMode {
  if ( g.matchingTeamMode !== 3 ) return "other";
  if ( g.matchingMode === 3 ) return "rankSquad";
  if ( g.matchingMode === 2 ) return "normalSquad";
  return "other";
}

// matchingTeamMode가 곧 팀 인원이다 (1 솔로, 2 듀오, 3 스쿼드).
const teamCount = (g: UserGameRecord) => Math.max(1, Math.round(g.matchSize / Math.min(Math.max(g.matchingTeamMode, 1), 3)));

function toRecord(g: UserGameRecord): RecentRecord {
  const mode = modeOf(g);
  return {
    gameId: g.gameId,
    teamNumber: g.teamNumber,
    mode,
    rank: g.gameRank,
    teams: teamCount(g),
    rp: mode === "rankSquad" ? g.mmrGain ?? null : null,
    mmrBefore: mode === "rankSquad" ? g.mmrBefore ?? null : null,
    damage: g.damageToPlayer,
    characterCode: g.characterNum,
    weaponCode: groupWeaponCode(g.characterNum, g.bestWeapon),
    vision: {
      view: g.viewContribution ?? 0,
      cam: g.addTelephotoCamera ?? 0,
      camRemove: g.removeTelephotoCamera ?? 0,
      drone: g.useReconDrone ?? 0,
    },
    kills: g.playerKill ?? 0,
    assists: g.playerAssistant ?? 0,
    deaths: g.playerDeaths ?? 0,
    teamKill: g.teamKill ?? 0,
    teamDamage: null,
  };
}

// 시즌 랭크 통계의 실험체별 집계 (/v2/user/stats, docs/API_NOTES.md). 모스트 3개만 오고 무기 구분이 없다.
// top3Rate·averageRank는 정수로 잘려 와서 쓰지 않는다.
export type SeasonCharacterStat = { characterCode: number; totalGames: number; wins: number; top3: number; maxKillings: number };

type UserStatsBody = ErApiBody & {
  userStats?: { matchingMode: number; matchingTeamMode: number; characterStats?: SeasonCharacterStat[] }[];
};

const RANK_MODE = 3;

// 랭크 스쿼드 시즌 모스트. 시즌 통계가 없거나 조회에 실패해도 분석은 이어 간다 (빈 배열).
async function fetchSeasonMost(userId: string, seasonId: number, signal: AbortSignal): Promise<SeasonCharacterStat[]> {
  try {
    const body = await callErApi<UserStatsBody>("user-stats", `/v2/user/stats/uid/${ encodeURIComponent(userId) }/${ seasonId }/${ RANK_MODE }`, { signal });
    const squad = body?.userStats?.find((s) => s.matchingTeamMode === 3);
    return ( squad?.characterStats ?? [] ).map((c) => ({
      characterCode: c.characterCode,
      totalGames: c.totalGames,
      wins: c.wins,
      top3: c.top3,
      maxKillings: c.maxKillings,
    }));
  } catch (error) {
    if ( error instanceof ErApiBusyError || signal.aborted ) throw error;
    console.warn(`[report] 시즌 통계 조회 실패: ${ error instanceof Error ? error.name : "unknown" }`);
    return [];
  }
}

export type RecentResult = { records: RecentRecord[]; most: SeasonCharacterStat[] };

// 최신 판부터 돌려준다. 닉네임이 없으면 null.
// 시즌 모스트는 최근 랭크 판의 시즌으로 조회한다. 최근에 랭크 판이 없으면 조회하지 않는다.
export async function fetchRecentGames(nickname: string, signal: AbortSignal): Promise<RecentResult | null> {
  const user = await callErApi<ErApiBody & { user: { userId: string } }>(
    "nickname",
    `/v1/user/nickname?query=${ encodeURIComponent(nickname) }`,
    { signal },
  );
  if ( !user ) return null;

  const records: RecentRecord[] = [];
  let seasonId = 0;
  let next: number | undefined;
  for ( let page = 0; page < MAX_PAGES && records.length < RECENT_COUNT; page++ ) {
    const query = next === undefined ? "" : `?next=${ next }`;
    const body = await callErApi<ErApiBody & { userGames?: UserGameRecord[]; next?: number }>(
      "user-games",
      `/v1/user/games/uid/${ encodeURIComponent(user.user.userId) }${ query }`,
      { signal },
    );
    for ( const g of body?.userGames ?? [] ) {
      if ( isCobalt(g) ) continue;
      records.push(toRecord(g));
      if ( g.seasonId > seasonId ) seasonId = g.seasonId;
    }
    next = body?.next;
    if ( next === undefined ) break;
  }
  const most = seasonId > 0 ? await fetchSeasonMost(user.user.userId, seasonId, signal) : [];
  return { records: records.slice(0, RECENT_COUNT), most };
}
