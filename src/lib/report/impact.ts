import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { groupedWeapon } from "@/lib/weapon-groups";

// 캐리·버스 판정의 기준: 같은 실험체·무기가 TOP3로 끝난 판의 평균 딜량·KDA.
// TOP3 판은 오래 살아남아 딜량·KDA가 전체 평균보다 크게 높다 (2026-10-26 DB: 딜량 1.6배, KDA 2.1배).
// 전체 평균과 비교하면 TOP3 판 대부분이 캐리로 나와서 TOP3 판끼리 비교한다.
// TOP3 표본이 부족한 실험체는 전체 평균에 DB 전체의 TOP3 배율을 곱해 쓴다.
// KDA 기준은 판별 KDA의 평균이다. 판 하나의 KDA와 비교하므로 합의 비율(lib/report/kda.ts)보다 이쪽이 맞다
// (데스가 적은 판에서 판별 KDA가 크게 튀어, 합의 비율과 비교하면 캐리가 과하게 나온다).

const PICK_MIN_ROWS = 20; // 실험체 티어와 같은 기준

export type ImpactBase = { damage: number | null; kda: number | null };

type Row = { rows: number; damage: number; kda: number };

export function loadImpactBaseline(): (characterCode: number, weaponCode: number) => ImpactBase {
  const weapon = groupedWeapon(participants);
  const top3 = sql<number>`case when ${ participants.gameRank } <= 3 then 1 else 0 end`;
  const rows = db
    .select({
      characterCode: participants.characterCode,
      weaponCode: weapon,
      top3,
      rows: sql<number>`count(*)`,
      damage: sql<number>`avg(${ participants.damageToPlayer })`,
      kda: sql<number>`avg(( ${ participants.playerKill } + ${ participants.playerAssistant } ) * 1.0 / max(${ participants.playerDeaths }, 1))`,
    })
    .from(participants)
    .where(sql`${ participants.playerKill } is not null and ${ participants.damageToPlayer } is not null`)
    .groupBy(participants.characterCode, weapon, top3)
    .all();

  // DB 전체의 TOP3 배율 (TOP3 판 평균 / 전체 평균)
  const total = (pick: (r: Row) => number, only?: number) => {
    const rs = rows.filter((r) => only === undefined || r.top3 === only);
    const n = rs.reduce((s, r) => s + r.rows, 0);
    return n ? rs.reduce((s, r) => s + pick(r) * r.rows, 0) / n : 0;
  };
  const damageAll = total((r) => r.damage);
  const kdaAll = total((r) => r.kda);
  const damageFactor = damageAll ? total((r) => r.damage, 1) / damageAll : 1;
  const kdaFactor = kdaAll ? total((r) => r.kda, 1) / kdaAll : 1;

  const byPick = new Map<string, { top3?: Row; rest?: Row }>();
  for ( const r of rows ) {
    const k = `${ r.characterCode }:${ r.weaponCode }`;
    byPick.set(k, { ...byPick.get(k), [ r.top3 ? "top3" : "rest" ]: r });
  }

  return (characterCode, weaponCode) => {
    const pick = byPick.get(`${ characterCode }:${ weaponCode }`);
    if ( pick?.top3 && pick.top3.rows >= PICK_MIN_ROWS ) return { damage: pick.top3.damage, kda: pick.top3.kda };
    // 표본이 부족하면 TOP3·나머지를 합친 실험체 평균에 배율을 곱한다.
    const parts = [ pick?.top3, pick?.rest ].filter((r): r is Row => r !== undefined);
    const n = parts.reduce((s, r) => s + r.rows, 0);
    if ( n < PICK_MIN_ROWS ) return { damage: null, kda: null };
    const avg = (f: (r: Row) => number) => parts.reduce((s, r) => s + f(r) * r.rows, 0) / n;
    return { damage: avg((r) => r.damage) * damageFactor, kda: avg((r) => r.kda) * kdaFactor };
  };
}
