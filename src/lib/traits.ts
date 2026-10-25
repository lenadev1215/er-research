import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { participants, traits } from "@/db/schema";

export type TraitShare = { code: number; name: string; games: number; share: number };

// 메타의 Core/Sub 구분은 예외가 있어(폭발 선인장) 실제 경기에서 핵심 특성 자리에 나온 코드를 기준으로 한다.
export function getCoreTraitShares(characterCode: number, weaponCode: number): TraitShare[] {
  const rows = db
    .select({
      code: participants.coreTraitCode,
      name: traits.name,
      games: sql<number>`count(*)`,
    })
    .from(participants)
    .leftJoin(traits, eq(traits.code, participants.coreTraitCode))
    .where(and(eq(participants.characterCode, characterCode), eq(participants.weaponCode, weaponCode)))
    .groupBy(participants.coreTraitCode)
    .all();

  const total = rows.reduce((sum, r) => sum + r.games, 0);
  return rows
    .map((r) => ({ code: r.code, name: r.name ?? `#${ r.code }`, games: r.games, share: r.games / total }))
    .sort((x, y) => y.share - x.share);
}
