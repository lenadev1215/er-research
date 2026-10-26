import "server-only";

// 웹 요청용 Open API 호출 (전적 분석 탭). 수집기용 scripts/er-api.mts와 판단 기준은 같다.
// 다른 점: 동시 요청을 전역 큐로 직렬화하고, 재시도를 짧게 끊고, 로그에 경로를 남기지 않는다 (경로에 닉네임·userId가 들어간다).
// 큐는 인스턴스 메모리라 서버리스 인스턴스끼리는 공유되지 않는다.

const API_BASE = "https://open-api.bser.io";
const REQUEST_INTERVAL_MS = 1100;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_PENDING = 8; // 대기열이 이보다 길면 바로 거절한다 (대기 시간이 웹 요청에 맞지 않는다)

export type ErApiBody = { code: number; message: string };

// 로그와 오류 메시지에는 경로 대신 이 라벨만 쓴다.
export type ErApiLabel = "nickname" | "user-games" | "user-stats" | "game";

export class ErApiBusyError extends Error {
  constructor() {
    super("Open API 대기열이 가득 찼습니다.");
    this.name = "ErApiBusyError";
  }
}

export class ErApiError extends Error {
  readonly label: ErApiLabel;
  readonly code: number;

  constructor(label: ErApiLabel, code: number) {
    super(`Open API 오류 ${ code } (${ label })`);
    this.name = "ErApiError";
    this.label = label;
    this.code = code;
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if ( signal?.aborted ) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });

let lastStartAt = 0;
let queueTail: Promise<void> = Promise.resolve();
let pending = 0;

// 호출 시작 시각 사이를 REQUEST_INTERVAL_MS 이상 벌린다. 재시도도 다시 큐를 탄다.
// 대기 중에 취소돼도 자리는 그대로 소비한다 (간격을 보수적으로 지키는 쪽).
function acquireSlot(): Promise<void> {
  if ( pending >= MAX_PENDING ) return Promise.reject(new ErApiBusyError());
  pending++;
  const slot = queueTail.then(async () => {
    const wait = lastStartAt + REQUEST_INTERVAL_MS - Date.now();
    if ( wait > 0 ) await sleep(wait);
    lastStartAt = Date.now();
  });
  queueTail = slot;
  return slot.finally(() => {
    pending--;
  });
}

// HTTP 200이어도 body code가 401/404일 수 있어 body 기준으로 판단한다. 404는 null.
export async function callErApi<T extends ErApiBody>(
  label: ErApiLabel,
  path: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<T | null> {
  const apiKey = process.env.ER_API_KEY;
  if ( !apiKey ) throw new Error("ER_API_KEY가 설정되지 않았습니다.");

  let lastCode = 0;
  for ( let attempt = 0; attempt < MAX_ATTEMPTS; attempt++ ) {
    if ( attempt > 0 ) await sleep(RETRY_BASE_MS * 2 ** ( attempt - 1 ), signal);
    await acquireSlot();
    signal?.throwIfAborted();

    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const res = await fetch(`${ API_BASE }${ path }`, {
      headers: { "x-api-key": apiKey },
      signal: signal ? AbortSignal.any([ signal, timeout ]) : timeout,
      cache: "no-store",
    }).catch((error: unknown) => error);

    // 호출한 쪽이 취소했으면 재시도하지 않는다. 타임아웃·연결 끊김은 재시도한다.
    signal?.throwIfAborted();
    if ( !( res instanceof Response ) ) {
      lastCode = 0;
      console.warn(`[er-api] ${ label } 네트워크 오류, 재시도 ${ attempt + 1 }/${ MAX_ATTEMPTS }`);
      continue;
    }

    const body = (await res.json().catch(() => null)) as T | null;
    const code = body?.code ?? res.status;
    lastCode = code;

    if ( code === 200 && body ) return body;
    if ( code === 404 ) return null;
    if ( !body || code === 429 || res.status === 429 || res.status >= 500 ) {
      console.warn(`[er-api] ${ label } ${ code } 응답, 재시도 ${ attempt + 1 }/${ MAX_ATTEMPTS }`);
      continue;
    }
    throw new ErApiError(label, code);
  }
  throw new ErApiError(label, lastCode);
}
