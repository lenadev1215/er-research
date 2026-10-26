// 수집 스크립트 공용 Open API 호출. 키는 .env.local의 ER_API_KEY에서만 읽고 로그에 남기지 않는다.
process.loadEnvFile(".env.local");

const API_BASE = "https://open-api.bser.io";
const API_KEY = process.env.ER_API_KEY;
const REQUEST_INTERVAL_MS = 1100;
const MAX_RETRIES = 5;

if ( !API_KEY ) {
  throw new Error("ER_API_KEY가 .env.local에 없습니다.");
}

export type ApiBody = { code: number; message: string };

export type GameRecord = {
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
  mmrAfter: number;
  mmrGain: number;
  preMade: number;
  teamKill: number;
  damageToPlayer: number;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 모든 호출 뒤에 간격을 두고, 429는 지수 백오프로 재시도한다.
// HTTP 200이어도 body code가 401/404일 수 있어 body 기준으로 판단한다.
export async function callApi<T extends ApiBody>(path: string): Promise<T | null> {
  for ( let attempt = 0; attempt < MAX_RETRIES; attempt++ ) {
    // 타임아웃·연결 끊김 같은 네트워크 오류도 429처럼 기다렸다가 다시 시도한다 (몇 시간 도는 수집이 한 번에 죽지 않게).
    const res = await fetch(`${ API_BASE }${ path }`, { headers: { "x-api-key": API_KEY! } }).catch((error: unknown) => error);
    await sleep(REQUEST_INTERVAL_MS);
    if ( !( res instanceof Response ) ) {
      const wait = 2 ** attempt * 2000;
      console.warn(`  네트워크 오류(${ res instanceof Error ? res.message : String(res) }), ${ wait / 1000 }초 후 재시도: ${ path }`);
      await sleep(wait);
      continue;
    }

    const body = (await res.json().catch(() => null)) as T | null;
    const code = body?.code ?? res.status;

    if ( code === 200 && body ) return body;
    if ( code === 404 ) return null;
    // 본문이 JSON으로 읽히지 않으면(응답이 중간에 끊긴 경우 등) HTTP 200이어도 다시 시도한다.
    if ( !body || code === 429 || res.status === 429 || res.status >= 500 ) {
      const wait = 2 ** attempt * 2000;
      console.warn(`  ${ code } 응답, ${ wait / 1000 }초 후 재시도: ${ path }`);
      await sleep(wait);
      continue;
    }
    throw new Error(`API 오류 ${ code } (${ body?.message ?? res.statusText }): ${ path }`);
  }
  throw new Error(`재시도 초과: ${ path }`);
}

export const fetchGame = async (gameId: number) =>
  (await callApi<ApiBody & { userGames: GameRecord[] }>(`/v1/games/${ gameId }`))?.userGames ?? [];
