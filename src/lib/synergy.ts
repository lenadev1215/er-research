import "server-only";
import { and, eq, gt, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import { characters, games, participants, traits, weapons } from "@/db/schema";
import { aggregateSynergy, type SynergyCombo, type TeamRow } from "./synergy-aggregate";

export type SynergyQuery = {
  characterCode: number;
  weaponCode: number;
  coreTraitCode?: number;
};

export type SynergyResponse = {
  me: { characterName: string; weaponName: string; coreTraitName: string | null };
  totalGames: number;
  combos: SynergyCombo[];
};

function fetchTeamRows({ characterCode, weaponCode, coreTraitCode }: SynergyQuery): TeamRow[] {
  const me = alias(participants, "me");
  const a = alias(participants, "a");
  const b = alias(participants, "b");

  const conditions: SQL[] = [ eq(me.characterCode, characterCode), eq(me.weaponCode, weaponCode) ];
  if ( coreTraitCode !== undefined ) conditions.push(eq(me.coreTraitCode, coreTraitCode));

  // 같은 팀의 나머지 두 명을 a, b로 붙인다. b.id > a.id로 팀당 한 행만 남긴다.
  const rows = db
    .select({
      gameRank: me.gameRank,
      mmrGain: me.mmrGain,
      teamCount: games.teamCount,
      aCharacter: a.characterCode,
      aWeapon: a.weaponCode,
      bCharacter: b.characterCode,
      bWeapon: b.weaponCode,
    })
    .from(me)
    .innerJoin(games, eq(games.id, me.gameId))
    .innerJoin(a, and(eq(a.gameId, me.gameId), eq(a.teamNumber, me.teamNumber), ne(a.id, me.id)))
    .innerJoin(b, and(
      eq(b.gameId, me.gameId),
      eq(b.teamNumber, me.teamNumber),
      ne(b.id, me.id),
      gt(b.id, a.id),
    ))
    .where(and(...conditions))
    .all();

  return rows.map((r) => ({
    gameRank: r.gameRank,
    mmrGain: r.mmrGain,
    teamCount: r.teamCount,
    mates: [
      { characterCode: r.aCharacter, weaponCode: r.aWeapon },
      { characterCode: r.bCharacter, weaponCode: r.bWeapon },
    ],
  }));
}

export function getSynergy(query: SynergyQuery): SynergyResponse {
  const characterNames = new Map(db.select().from(characters).all().map((c) => [ c.code, c.name ]));
  const weaponNames = new Map(db.select().from(weapons).all().map((w) => [ w.code, w.name ]));
  const trait = query.coreTraitCode === undefined
    ? undefined
    : db.select().from(traits).where(eq(traits.code, query.coreTraitCode)).get();

  const names = {
    character: (code: number) => characterNames.get(code) ?? `#${ code }`,
    weapon: (code: number) => weaponNames.get(code) ?? `#${ code }`,
  };

  const rows = fetchTeamRows(query);
  const combos = aggregateSynergy(rows, names)
    .sort((x, y) => y.games - x.games || y.avgRp - x.avgRp);

  return {
    me: {
      characterName: names.character(query.characterCode),
      weaponName: names.weapon(query.weaponCode),
      coreTraitName: trait?.name ?? null,
    },
    totalGames: rows.length,
    combos,
  };
}
