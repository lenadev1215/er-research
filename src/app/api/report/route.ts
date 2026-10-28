import { NextResponse } from "next/server";
import { ErApiBusyError } from "@/lib/er-api/client";
import { AdviceError, streamAdvice } from "@/lib/report/advice";
import { buildReport, judgeImpacts } from "@/lib/report/compare";
import { clientIp, nicknameKey, readCache, takeRateLimit, writeCache } from "@/lib/report/guard";
import { fetchRecentGames } from "@/lib/report/recent-games";
import { findImpactTeamDamage, findTeammates } from "@/lib/report/teammates";
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

async function* live(key: string, stats: ReportStats, signal: AbortSignal): AsyncGenerator<ReportEvent> {
  yield { type: "stats", stats };
  let advice = "";
  try {
    for await (const delta of streamAdvice(stats, signal)) {
      advice += delta;
      yield { type: "advice", delta };
    }
  } catch (error) {
    if ( signal.aborted ) return;
    const reason = error instanceof AdviceError ? ` (${ error.reason })` : "";
    console.warn(`[report] 소견 생성 실패: ${ error instanceof Error ? error.name : "unknown" }${ reason }`);
    yield { type: "error", code: "advice-failed" };
    return;
  }
  // 빈 소견은 캐시하지 않는다 (streamAdvice가 막지만 한 번 더 확인).
  if ( advice.trim() ) writeCache(key, stats, advice);
  yield { type: "done" };
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const nickname = typeof body === "object" && body !== null && "nickname" in body && typeof body.nickname === "string"
    ? body.nickname.trim()
    : "";

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
    const judgments = judgeImpacts(records);
    const impactIndices = judgments.flatMap((j, i) => ( j.impact ? [ i ] : [] ));
    const impactTeamDamage = await findImpactTeamDamage(records, impactIndices, teams, request.signal);
    stats = buildReport(records, teams, most, judgments, impactTeamDamage);
  } catch (error) {
    if ( error instanceof ErApiBusyError ) return fail("busy", 503);
    // 오류 메시지에는 경로가 없다 (er-api/client.ts). 그래도 이름만 남긴다.
    console.warn(`[report] 전적 조회 실패: ${ error instanceof Error ? error.name : "unknown" }`);
    return fail("upstream", 502);
  }

  return ndjson(live(key, stats, request.signal));
}
