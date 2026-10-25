// 소량 수집기: 상위 랭커에서 출발해 경기 참가자를 따라가며 랭크 스쿼드 경기를 모은다.
// 사용법: pnpm collect [목표 경기 수=300]
// 중단 후 다시 실행하면 crawl_users 대기열에서 이어서 수집한다.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { crawlUsers, games, participants } from "../src/db/schema.ts";

process.loadEnvFile(".env.local");

const API_BASE = "https://open-api.bser.io";
const API_KEY = process.env.ER_API_KEY;
const SEASON_ID = 41;
const RANKED = 3;
const SQUAD = 3;
const REQUEST_INTERVAL_MS = 1100;
const MAX_RETRIES = 5;
const targetGames = Number(process.argv[ 2 ] ?? 300);

if ( !API_KEY ) {
  throw new Error("ER_API_KEY가 .env.local에 없습니다.");
}

const sqlite = new Database("./data/er.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

type ApiBody = { code: number; message: string };

type GameRecord = {
  gameId: number;
  nickname: string;
  seasonId: number;
  matchingMode: number;
  matchingTeamMode: number;
  versionMajor: number;
  versionMinor: number;
  startDtm: string;
  mmrAvg: number;
  teamNumber: number;
  gameRank: number;
  characterNum: number;
  bestWeapon: number;
  traitFirstCore: number;
  mmrBefore: number;
  mmrGain: number;
  preMade: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 모든 호출 뒤에 간격을 두고, 429는 지수 백오프로 재시도한다.
// HTTP 200이어도 body code가 401/404일 수 있어 body 기준으로 판단한다.
async function callApi<T extends ApiBody>(path: string): Promise<T | null> {
  for ( let attempt = 0; attempt < MAX_RETRIES; attempt++ ) {
    const res = await fetch(`${ API_BASE }${ path }`, { headers: { "x-api-key": API_KEY! } });
    await sleep(REQUEST_INTERVAL_MS);

    const body = (await res.json().catch(() => null)) as T | null;
    const code = body?.code ?? res.status;

    if ( code === 200 && body ) return body;
    if ( code === 404 ) return null;
    if ( code === 429 || res.status === 429 || res.status >= 500 ) {
      const wait = 2 ** attempt * 2000;
      console.warn(`  ${ code } 응답, ${ wait / 1000 }초 후 재시도: ${ path }`);
      await sleep(wait);
      continue;
    }
    throw new Error(`API 오류 ${ code } (${ body?.message ?? res.statusText }): ${ path }`);
  }
  throw new Error(`재시도 초과: ${ path }`);
}

const now = () => new Date().toISOString();

function enqueue(nicknames: string[]) {
  if ( nicknames.length === 0 ) return;
  db.insert(crawlUsers)
    .values(nicknames.map((nickname) => ({ nickname, createdAt: now() })))
    .onConflictDoNothing()
    .run();
}

async function seedFromTopRanks() {
  const queued = db.select({ n: sql<number>`count(*)` }).from(crawlUsers).get();
  if ( queued && queued.n > 0 ) return;

  const body = await callApi<ApiBody & { topRanks: { nickname: string }[] }>(
    `/v1/rank/top/${ SEASON_ID }/${ SQUAD }`,
  );
  enqueue(body?.topRanks.map((r) => r.nickname) ?? []);
  console.log(`상위 랭커 ${ body?.topRanks.length ?? 0 }명을 대기열에 추가`);
}

const isTargetGame = (g: GameRecord) =>
  g.seasonId === SEASON_ID && g.matchingMode === RANKED && g.matchingTeamMode === SQUAD;

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
      const detail = await callApi<ApiBody & { userGames: GameRecord[] }>(`/v1/games/${ gameId }`);
      const records = detail?.userGames ?? [];
      if ( records.length === 0 || !isTargetGame(records[ 0 ]) ) continue;

      saveGame(records);
      enqueue(records.map((r) => r.nickname));
      saved++;
    }
  }

  db.update(crawlUsers).set({ lastCrawledAt: now() }).where(eq(crawlUsers.nickname, nickname)).run();
  return saved;
}

async function main() {
  await seedFromTopRanks();

  let collected = 0;
  while ( collected < targetGames ) {
    const next = db.select().from(crawlUsers)
      .where(isNull(crawlUsers.lastCrawledAt))
      .orderBy(asc(crawlUsers.createdAt))
      .limit(1)
      .get();
    if ( !next ) {
      console.log("대기열이 비었습니다.");
      break;
    }

    collected += await crawlUser(next.nickname, next.userId);
    console.log(`경기 ${ collected }/${ targetGames }`);
  }

  const total = db.select({ n: sql<number>`count(*)` }).from(games).get();
  console.log(`완료: 이번 실행 ${ collected }판, DB 누적 ${ total?.n ?? 0 }판`);
}

main().finally(() => sqlite.close());
