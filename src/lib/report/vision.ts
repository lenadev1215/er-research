import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { participants } from "@/db/schema";
import { groupedWeapon } from "@/lib/weapon-groups";
import type { VisionMetrics } from "./types";

// 시야 점수: 시야 지표 4개를 DB 참가자 분포로 표준화해 평균 낸 뒤 50 ± 15 척도로 바꾼다 (기준 50).
// 2026-10-26 표본 비교에서 단순 합·표준화 평균·시야 기여 단독 모두 순위와의 상관이 비슷했다 (−0.78~−0.80).
// 표준화 평균은 선형이라 "판별 점수의 평균 = 평균 지표의 점수"다. 그래서 DB 쪽은 평균만 집계하면 된다.
// 조합 분석 탭에서는 쓰지 않는다 (사용자 결정). 전적 분석 전용.

const MIN_ROWS = 1000; // 시야가 채워진 참가자가 이보다 적으면 분포를 믿지 않는다 (backfill 진행 중)
const PICK_MIN_ROWS = 20; // 실험체·무기별 DB 평균의 최소 표본 (실험체 티어와 같은 기준)

const KEYS = [ "view", "cam", "camRemove", "drone" ] as const;

type Norm = { mean: number; sd: number };

export type VisionBaseline = {
  score: (v: VisionMetrics) => number | null; // 분포가 아직 없으면 null
  pick: (characterCode: number, weaponCode: number) => VisionMetrics | null; // 표본 부족이면 null
};

const columns = {
  view: participants.viewContribution,
  cam: participants.telephotoCameraAdd,
  camRemove: participants.telephotoCameraRemove,
  drone: participants.reconDroneUse,
};

export function loadVisionBaseline(): VisionBaseline {
  // 분산 = E[x²] − E[x]². 시야 열이 모두 채워진 행만 쓴다 (backfill은 4열을 한 번에 채운다).
  const filled = sql`${ participants.viewContribution } is not null`;
  const g = db
    .select({
      rows: sql<number>`count(*)`,
      view: sql<number>`avg(${ columns.view })`,
      viewSq: sql<number>`avg(${ columns.view } * ${ columns.view })`,
      cam: sql<number>`avg(${ columns.cam })`,
      camSq: sql<number>`avg(${ columns.cam } * ${ columns.cam })`,
      camRemove: sql<number>`avg(${ columns.camRemove })`,
      camRemoveSq: sql<number>`avg(${ columns.camRemove } * ${ columns.camRemove })`,
      drone: sql<number>`avg(${ columns.drone })`,
      droneSq: sql<number>`avg(${ columns.drone } * ${ columns.drone })`,
    })
    .from(participants)
    .where(filled)
    .get();

  const norm = (mean: number, sq: number): Norm => ({ mean, sd: Math.sqrt(Math.max(sq - mean * mean, 0)) });
  const norms: Record<( typeof KEYS )[ number ], Norm> | null = g && g.rows >= MIN_ROWS
    ? {
      view: norm(g.view, g.viewSq),
      cam: norm(g.cam, g.camSq),
      camRemove: norm(g.camRemove, g.camRemoveSq),
      drone: norm(g.drone, g.droneSq),
    }
    : null;

  const weapon = groupedWeapon(participants);
  const rows = db
    .select({
      characterCode: participants.characterCode,
      weaponCode: weapon,
      rows: sql<number>`count(*)`,
      view: sql<number>`avg(${ columns.view })`,
      cam: sql<number>`avg(${ columns.cam })`,
      camRemove: sql<number>`avg(${ columns.camRemove })`,
      drone: sql<number>`avg(${ columns.drone })`,
    })
    .from(participants)
    .where(filled)
    .groupBy(participants.characterCode, weapon)
    .all();
  const byPick = new Map(rows
    .filter((r) => r.rows >= PICK_MIN_ROWS)
    .map((r) => [ `${ r.characterCode }:${ r.weaponCode }`, { view: r.view, cam: r.cam, camRemove: r.camRemove, drone: r.drone } ]));

  return {
    score: (v) => {
      if ( !norms ) return null;
      // 표준편차가 0인 지표(모두 같은 값)는 점수에 영향을 주지 않게 0으로 둔다.
      const z = KEYS.map((k) => ( norms[ k ].sd > 0 ? ( v[ k ] - norms[ k ].mean ) / norms[ k ].sd : 0 ));
      return 50 + 15 * ( z.reduce((s, x) => s + x, 0) / z.length );
    },
    pick: (characterCode, weaponCode) => byPick.get(`${ characterCode }:${ weaponCode }`) ?? null,
  };
}
