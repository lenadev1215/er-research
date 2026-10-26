// 수집기: 다이아몬드 하위 구간부터 경기 참가자를 따라가며 랭크 스쿼드 경기를 모은다.
// 사용법: pnpm collect [목표 경기 수=300] [최대 실행 시간(시간)]
// 중단 후 다시 실행하면 crawl_users 대기열에서 이어서 수집한다.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { and, asc, between, eq, gte, isNull, sql } from "drizzle-orm";
import { crawlUsers, games, participants } from "../src/db/schema.ts";
import { callApi, fetchGame, type ApiBody, type GameRecord } from "./er-api.mts";

const SEASON_ID = 41;
const RANKED = 3;
const SQUAD = 3;

// 다이아몬드 5000~6399 (시즌 41, 사용자 확인). 이 값 이상인 유저를 MMR 낮은 순으로 처리한다.
const DIAMOND_MIN = 5000;
const DIAMOND_MAX = 6399;
const SEED_GAMES = 60; // 씨앗 확보용으로 다시 조회할 기존 경기 수

const targetGames = Number(process.argv[ 2 ] ?? 300);
const maxHours = Number(process.argv[ 3 ] ?? Infinity);
const deadline = Date.now() + maxHours * 3_600_000;

const sqlite = new Database("./data/er.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

const now = () => new Date().toISOString();

// 대기열에 넣고, 이미 있으면 MMR만 최신 값으로 갱신한다.
function enqueue(users: { nickname: string; mmr: number | null }[]) {
  if ( users.length === 0 ) return;
  db.insert(crawlUsers)
    .values(users.map((u) => ({ nickname: u.nickname, lastMmr: u.mmr, createdAt: now() })))
    .onConflictDoUpdate({ target: crawlUsers.nickname, set: { lastMmr: sql`coalesce(excluded.last_mmr, ${ crawlUsers.lastMmr })` } })
    .run();
}

const enqueueParticipants = (records: GameRecord[]) =>
  enqueue(records.map((r) => ({ nickname: r.nickname, mmr: r.mmrAfter ?? r.mmrBefore })));

const isTargetGame = (g: GameRecord) =>
  g.seasonId === SEASON_ID && g.matchingMode === RANKED && g.matchingTeamMode === SQUAD;

const diamondQueueSize = () =>
  db.select({ n: sql<number>`count(*)` }).from(crawlUsers)
    .where(and(isNull(crawlUsers.lastCrawledAt), gte(crawlUsers.lastMmr, DIAMOND_MIN)))
    .get()?.n ?? 0;

// 대기열에 다이아몬드 이상 유저가 없으면 씨앗을 만든다.
// 기존 경기 중 다이아몬드 참가자가 있던 판을 다시 조회해 참가자를 MMR과 함께 넣는다.
// 기존 DB가 비어 있으면 상위 랭커에서 출발한다.
async function seedQueue() {
  if ( diamondQueueSize() > 0 ) return;

  const seedGameIds = db.selectDistinct({ id: participants.gameId }).from(participants)
    .where(between(participants.mmrBefore, DIAMOND_MIN, DIAMOND_MAX))
    .limit(SEED_GAMES)
    .all()
    .map((r) => r.id);

  if ( seedGameIds.length > 0 ) {
    for ( const id of seedGameIds ) enqueueParticipants(await fetchGame(id));
    console.log(`다이아몬드 경기 ${ seedGameIds.length }판에서 씨앗 확보, 대기열 ${ diamondQueueSize() }명`);
    return;
  }

  const body = await callApi<ApiBody & { topRanks: { nickname: string; mmr: number }[] }>(
    `/v1/rank/top/${ SEASON_ID }/${ SQUAD }`,
  );
  enqueue(body?.topRanks.map((r) => ({ nickname: r.nickname, mmr: r.mmr })) ?? []);
  console.log(`상위 랭커 ${ body?.topRanks.length ?? 0 }명을 대기열에 추가`);
}

function saveGame(records: GameRecord[]) {
  const first = records[ 0 ];
  db.transaction((tx) => {
    tx.insert(games).values({
      id: first.gameId,
      seasonId: first.seasonId,
      versionMajor: first.versionMajor,
      versionMinor: first.versionMinor,
      startedAt: first.startDtm,
      teamCount: new Set(records.map((r) => r.teamNumber)).size,
      avgMmr: first.mmrAvg,
    }).run();

    tx.insert(participants).values(records.map((r) => ({
      gameId: r.gameId,
      teamNumber: r.teamNumber,
      gameRank: r.gameRank,
      characterCode: r.characterNum,
      weaponCode: r.bestWeapon,
      coreTraitCode: r.traitFirstCore,
      mmrBefore: r.mmrBefore,
      mmrGain: r.mmrGain,
      teamKill: r.teamKill,
      damageToPlayer: r.damageToPlayer,
      preMade: r.preMade,
    }))).run();
  });
}

const gameExists = (gameId: number) =>
  db.select({ id: games.id }).from(games).where(eq(games.id, gameId)).get() !== undefined;

async function crawlUser(nickname: string, knownUserId: string | null): Promise<number> {
  let userId = knownUserId;
  if ( !userId ) {
    const body = await callApi<ApiBody & { user: { userId: string } }>(
      `/v1/user/nickname?query=${ encodeURIComponent(nickname) }`,
    );
    userId = body?.user.userId ?? null;
    if ( userId ) {
      db.update(crawlUsers).set({ userId }).where(eq(crawlUsers.nickname, nickname)).run();
    }
  }

  let saved = 0;
  if ( userId ) {
    const list = await callApi<ApiBody & { userGames: GameRecord[] }>(
      `/v1/user/games/uid/${ encodeURIComponent(userId) }`,
    );
    const gameIds = (list?.userGames ?? []).filter(isTargetGame).map((g) => g.gameId);

    for ( const gameId of gameIds ) {
      if ( gameExists(gameId) ) continue;
      const records = await fetchGame(gameId);
      if ( records.length === 0 || !isTargetGame(records[ 0 ]) ) continue;

      saveGame(records);
      enqueueParticipants(records);
      saved++;
    }
  }

  db.update(crawlUsers).set({ lastCrawledAt: now() }).where(eq(crawlUsers.nickname, nickname)).run();
  return saved;
}

async function main() {
  await seedQueue();

  let collected = 0;
  while ( collected < targetGames ) {
    if ( Date.now() > deadline ) {
      console.log(`실행 시간 ${ maxHours }시간 도달`);
      break;
    }

    // 다이아몬드 이상 중 MMR이 낮은 유저부터 처리한다.
    const next = db.select().from(crawlUsers)
      .where(and(isNull(crawlUsers.lastCrawledAt), gte(crawlUsers.lastMmr, DIAMOND_MIN)))
      .orderBy(asc(crawlUsers.lastMmr))
      .limit(1)
      .get();
    if ( !next ) {
      console.log("대기열에 다이아몬드 이상 유저가 없습니다.");
      break;
    }

    collected += await crawlUser(next.nickname, next.userId);
    console.log(`경기 ${ collected }/${ targetGames } (현재 MMR ${ next.lastMmr })`);
  }

  const total = db.select({ n: sql<number>`count(*)` }).from(games).get();
  console.log(`완료: 이번 실행 ${ collected }판, DB 누적 ${ total?.n ?? 0 }판`);
}

main().finally(() => sqlite.close());
