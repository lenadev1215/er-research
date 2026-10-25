import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { characters, participants, weapons } from "@/db/schema";

export type PickOption = {
  code: number;
  name: string;
  games: number;
  weapons: { code: number; name: string; games: number }[]; // 판수 많은 순
};

// 수집 데이터에 실제로 등장한 실험체와 무기만 선택지로 낸다.
export function getPicks(): PickOption[] {
  const rows = db
    .select({
      characterCode: participants.characterCode,
      characterName: characters.name,
      weaponCode: participants.weaponCode,
      weaponName: weapons.name,
      games: sql<number>`count(*)`,
    })
    .from(participants)
    .leftJoin(characters, eq(characters.code, participants.characterCode))
    .leftJoin(weapons, eq(weapons.code, participants.weaponCode))
    .groupBy(participants.characterCode, participants.weaponCode)
    .all();

  const byCharacter = new Map<number, PickOption>();
  for ( const r of rows ) {
    const pick = byCharacter.get(r.characterCode) ?? {
      code: r.characterCode,
      name: r.characterName ?? `#${ r.characterCode }`,
      games: 0,
      weapons: [],
    };
    pick.games += r.games;
    pick.weapons.push({ code: r.weaponCode, name: r.weaponName ?? `#${ r.weaponCode }`, games: r.games });
    byCharacter.set(r.characterCode, pick);
  }

  return [ ...byCharacter.values() ]
    .map((p) => ({ ...p, weapons: p.weapons.sort((x, y) => y.games - x.games) }))
    .sort((x, y) => x.name.localeCompare(y.name, "ko"));
}
