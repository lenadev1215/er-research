import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { ErApiBusyError } from "@/lib/er-api/client";
import { streamAdvice } from "@/lib/report/advice";
import { buildReport } from "@/lib/report/compare";
import { clientIp, nicknameKey, readCache, takeRateLimit, writeCache } from "@/lib/report/guard";
import { fetchRecentGames } from "@/lib/report/recent-games";
import { findTeammates } from "@/lib/report/teammates";
import type { ReportErrorCode, ReportEvent, ReportStats } from "@/lib/report/types";

// POST /api/report  body { nickname } → NDJSON 스트림 (stats → advice* → done | error)
// "페이지 요청 시 외부 API를 호출하지 않는다" 원칙의 예외다 (CLAUDE.md). 닉네임은 URL·로그에 남기지 않는다.
// 통계까지는 응답 전에 끝내 실패를 HTTP 상태로 돌려주고, 소견만 스트리밍한다.

export const maxDuration = 60;

const NICKNAME_MAX = 32; // ER 닉네임 규칙 미확인. 넉넉한 상한만 둔다

const fail = (code: ReportErrorCode, status: number, headers?: HeadersInit) => NextResponse.json({ code }, { status, headers });

function ndjson(events: AsyncIterable<ReportEvent>): Response {
  const encoder = new TextEncoder();
  const iterator = events[ Symbol.asyncIterator ]();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if ( done ) return controller.close();
      controller.enqueue(encoder.encode(`${ JSON.stringify(value) }\n`));
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function* replay(stats: ReportStats, advice: string): AsyncGenerator<ReportEvent> {
  yield { type: "stats", stats };
  yield { type: "advice", delta: advice };
  yield { type: "done" };
}

// key가 null이면 캐시에 남기지 않는다 (고정 데이터로 만든 소견).
async function* live(key: string | null, stats: ReportStats, signal: AbortSignal): AsyncGenerator<ReportEvent> {
  yield { type: "stats", stats };
  let advice = "";
  try {
    for await (const delta of streamAdvice(stats, signal)) {
      advice += delta;
      yield { type: "advice", delta };
    }
  } catch (error) {
    if ( signal.aborted ) return;
    console.warn(`[report] 소견 생성 실패: ${ error instanceof Error ? error.name : "unknown" }`);
    yield { type: "error", code: "advice-failed" };
    return;
  }
  if ( key ) writeCache(key, stats, advice);
  yield { type: "done" };
}

let fixtureTurn = 0;

// 고정 데이터 목록 "닉네임=경로,경로,…". 경로만 적은 항목은 name이 null이다.
const parseFixtures = (value: string | undefined) => ( value ?? "" ).split(",").map((e) => e.trim()).filter(Boolean).map((e) => {
  const at = e.lastIndexOf("=");
  return at < 0 ? { name: null, path: e } : { name: e.slice(0, at).trim(), path: e.slice(at + 1).trim() };
});

// 프롬프트 시험용 고정 데이터. "닉네임=경로"는 그 닉네임으로 검색할 때, 경로만 적은 항목과 등록되지 않은 닉네임은 차례로 돌린다.
// 닉네임은 .env.local(git 제외)에만 적는다. 개발 환경에서만 읽는다.
function pickFixture(nickname: string): string | null {
  if ( process.env.NODE_ENV !== "development" ) return null;
  const entries = parseFixtures(process.env.REPORT_DEV_FIXTURE);
  if ( entries.length === 0 ) return null;
  return entries.find((e) => e.name === nickname)?.path ?? entries[ fixtureTurn++ % entries.length ].path;
}

// 배포본 체험 모드: 등록된 닉네임만 고정 데이터(demo-fixtures/, git 제외)로 소견을 만든다. ER API를 부르지 않아 수집 중에도 켤 수 있다.
// 닉네임 매핑은 배포 명령의 환경 변수(REPORT_DEMO_FIXTURE)로만 넘긴다. 켜져 있지 않으면 undefined.
function pickDemo(nickname: string): { path: string | null } | undefined {
  const entries = parseFixtures(process.env.REPORT_DEMO_FIXTURE).filter((e) => e.name !== null);
  if ( entries.length === 0 ) return undefined;
  return { path: entries.find((e) => e.name === nickname)?.path ?? null };
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const nickname = typeof body === "object" && body !== null && "nickname" in body && typeof body.nickname === "string"
    ? body.nickname.trim()
    : "";

  // 프롬프트 시험용: 저장해 둔 통계로 소견만 만든다. ER API를 부르지 않아 수집기와 함께 돌릴 수 있다.
  // 파일은 data/*.local.json (git 제외).
  const fixture = pickFixture(nickname);
  if ( fixture ) {
    try {
      const stats = JSON.parse(await readFile(fixture, "utf8")) as ReportStats;
      return ndjson(live(null, stats, request.signal));
    } catch (error) {
      // 개발 환경 전용 분기라 원인을 그대로 돌려준다 (파일 경로·JSON 형식 확인용).
      return NextResponse.json({ code: "upstream", detail: String(error) }, { status: 500 });
    }
  }

  const demo = pickDemo(nickname);
  if ( demo ) {
    if ( nickname.length === 0 || nickname.length > NICKNAME_MAX ) return fail("invalid", 400);
    if ( !demo.path ) return fail("demo-only", 404);
    // 공개 주소라 Claude 호출을 막는 캐시와 IP 제한은 실제 조회와 같이 건다.
    const key = nicknameKey(nickname);
    const cached = readCache(key);
    if ( cached ) return ndjson(replay(cached.stats, cached.advice));
    const retryAfter = takeRateLimit(clientIp(request.headers));
    if ( retryAfter > 0 ) return fail("rate-limited", 429, { "Retry-After": String(retryAfter) });
    try {
      const stats = JSON.parse(await readFile(demo.path, "utf8")) as ReportStats;
      return ndjson(live(key, stats, request.signal));
    } catch (error) {
      // 경로에는 닉네임이 없다 (demo-fixtures/N.json). 원인 확인용으로 오류 코드만 남긴다.
      const code = error instanceof Error && "code" in error ? String(error.code) : "";
      console.warn(`[report] 체험 데이터 읽기 실패: ${ error instanceof Error ? error.name : "unknown" } ${ code }`);
      return fail("upstream", 500);
    }
  }

  // 키가 하나라 로컬 수집기를 돌리는 동안에는 배포본에서도 꺼 둔다.
  if ( process.env.REPORT_DISABLED === "1" ) return fail("disabled", 503);

  if ( nickname.length === 0 || nickname.length > NICKNAME_MAX ) return fail("invalid", 400);

  // 프롬프트를 반복해 시험할 때만 쓴다. 개발 환경에서만 캐시와 IP 제한을 건너뛴다.
  const skipGuard = process.env.NODE_ENV === "development" && process.env.REPORT_DEV_SKIP_GUARD === "1";

  const key = nicknameKey(nickname);
  const cached = skipGuard ? null : readCache(key);
  if ( cached ) return ndjson(replay(cached.stats, cached.advice));

  const retryAfter = skipGuard ? 0 : takeRateLimit(clientIp(request.headers));
  if ( retryAfter > 0 ) return fail("rate-limited", 429, { "Retry-After": String(retryAfter) });

  let stats: ReportStats;
  try {
    const recent = await fetchRecentGames(nickname, request.signal);
    if ( recent === null ) return fail("not-found", 404);
    const { records, most } = recent;
    if ( records.length === 0 ) return fail("no-games", 404);
    const teams = await findTeammates(records, request.signal);
    stats = buildReport(records, teams, most);
  } catch (error) {
    if ( error instanceof ErApiBusyError ) return fail("busy", 503);
    // 오류 메시지에는 경로가 없다 (er-api/client.ts). 그래도 이름만 남긴다.
    console.warn(`[report] 전적 조회 실패: ${ error instanceof Error ? error.name : "unknown" }`);
    return fail("upstream", 502);
  }

  return ndjson(live(key, stats, request.signal));
}
