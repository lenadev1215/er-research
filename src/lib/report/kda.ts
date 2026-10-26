import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { groupedWeapon } from "@/lib/weapon-groups";
import type { KdaMetrics } from "./types";

// KDA: (평균 킬 + 평균 어시스트) / 평균 데스. 판별 비율의 평균보다 데스가 적은 한 판에 덜 휘둘린다.
// 부활이 있어 데스가 0인 판은 드물다 (2026-10-26 랭크 3판 48명 중 1명). 그래도 평균 데스가 0이면 1로 나눈다.
// 화면에는 쓰지 않고 소견 입력에만 쓴다 (사용자 결정).

const PICK_MIN_ROWS = 20; // 실험체·무기별 DB 평균의 최소 표본 (실험체 티어와 같은 기준)

export const toKda = (kills: number, assists: number, deaths: number): KdaMetrics => ({
  kills,
  assists,
  deaths,
  kda: ( kills + assists ) / Math.max(deaths, 1),
});

// 실험체·무기별 DB 평균. 표본 부족이면 null.
export function loadKdaBaseline(): (characterCode: number, weaponCode: number) => KdaMetrics | null {
  const weapon = groupedWeapon(participants);
  const rows = db
    .select({
      characterCode: participants.characterCode,
      weaponCode: weapon,
      rows: sql<number>`count(*)`,
      kills: sql<number>`avg(${ participants.playerKill })`,
      assists: sql<number>`avg(${ participants.playerAssistant })`,
      deaths: sql<number>`avg(${ participants.playerDeaths })`,
    })
    .from(participants)
    .where(sql`${ participants.playerKill } is not null`)
    .groupBy(participants.characterCode, weapon)
    .all();

  const byPick = new Map(rows
    .filter((r) => r.rows >= PICK_MIN_ROWS)
    .map((r) => [ `${ r.characterCode }:${ r.weaponCode }`, toKda(r.kills, r.assists, r.deaths) ]));

  return (characterCode, weaponCode) => byPick.get(`${ characterCode }:${ weaponCode }`) ?? null;
}
