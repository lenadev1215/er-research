import "server-only";
import { createHash } from "node:crypto";
import type { ReportStats } from "./types";

// 전적 분석의 IP별 제한과 결과 캐시. 둘 다 인스턴스 메모리라 서버리스 인스턴스끼리는 공유되지 않는다.
// 캐시 키는 닉네임 해시라 메모리에도 닉네임 원문을 두지 않는다.

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 3; // 창 안에서 새로 분석하는 횟수. 캐시 적중은 세지 않는다
const CACHE_TTL_MS = 5 * 60_000;

const hits = new Map<string, number[]>();

// 허용되면 0, 막히면 다시 시도할 수 있을 때까지 남은 초.
export function takeRateLimit(ip: string): number {
  const now = Date.now();
  const recent = ( hits.get(ip) ?? [] ).filter((t) => now - t < RATE_WINDOW_MS);
  if ( recent.length >= RATE_LIMIT ) {
    hits.set(ip, recent);
    return Math.ceil(( recent[ 0 ] + RATE_WINDOW_MS - now ) / 1000);
  }
  hits.set(ip, [ ...recent, now ]);
  return 0;
}

// Vercel은 x-forwarded-for를 직접 채운다. 다른 호스트에서는 위조될 수 있다.
export const clientIp = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[ 0 ]?.trim() || headers.get("x-real-ip") || "unknown";

type CachedReport = { stats: ReportStats; advice: string; expiresAt: number };

const cache = new Map<string, CachedReport>();

export const nicknameKey = (nickname: string) => createHash("sha256").update(nickname.toLowerCase()).digest("hex");

export function readCache(key: string): CachedReport | null {
  const entry = cache.get(key);
  if ( !entry ) return null;
  if ( entry.expiresAt < Date.now() ) {
    cache.delete(key);
    return null;
  }
  return entry;
}

export function writeCache(key: string, stats: ReportStats, advice: string) {
  // 만료된 항목을 같이 치워 메모리가 계속 늘지 않게 한다.
  const now = Date.now();
  for ( const [ k, v ] of cache ) if ( v.expiresAt < now ) cache.delete(k);
  cache.set(key, { stats, advice, expiresAt: now + CACHE_TTL_MS });
}
