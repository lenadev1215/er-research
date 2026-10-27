// 클라이언트에서 /api/report의 NDJSON 스트림을 이벤트 단위로 읽는다.
import type { ReportErrorCode, ReportEvent, ReportStats } from "./types";

export class ReportError extends Error {
  readonly code: ReportErrorCode;

  constructor(code: ReportErrorCode) {
    super(code);
    this.name = "ReportError";
    this.code = code;
  }
}

// 스트림을 쌓은 화면용 상태. 조언은 조각을 이어 붙인다.
export type ReportState = {
  stats: ReportStats | null;
  advice: string;
  done: boolean;
  adviceFailed: boolean;
};

export const INITIAL_REPORT: ReportState = { stats: null, advice: "", done: false, adviceFailed: false };

export function reduceReport(acc: ReportState, event: ReportEvent): ReportState {
  switch ( event.type ) {
    case "stats":
      return { ...acc, stats: event.stats };
    case "advice":
      return { ...acc, advice: acc.advice + event.delta };
    case "done":
      return { ...acc, done: true };
    case "error":
      // 통계가 이미 왔으면 조언만 실패로 둔다. 통계 전이면 쿼리 자체를 실패시킨다.
      if ( acc.stats ) return { ...acc, done: true, adviceFailed: true };
      throw new ReportError(event.code);
  }
}

const isErrorCode = (v: unknown): v is ReportErrorCode => typeof v === "string";

export async function* streamReport(nickname: string, signal: AbortSignal): AsyncGenerator<ReportEvent> {
  const res = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
    signal,
  });
  if ( !res.ok || !res.body ) {
    const body: unknown = await res.json().catch(() => null);
    const code = typeof body === "object" && body !== null && "code" in body && isErrorCode(body.code) ? body.code : "upstream";
    throw new ReportError(code);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while ( true ) {
    const { value, done } = await reader.read();
    if ( done ) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for ( const line of lines ) {
      if ( line.trim() ) yield JSON.parse(line) as ReportEvent;
    }
  }
  if ( buffer.trim() ) yield JSON.parse(buffer) as ReportEvent;
}
