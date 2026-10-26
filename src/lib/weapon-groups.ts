import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// 경기 중 무기를 바꿔 쓰는 실험체는 bestWeapon(그 판에서 가장 많이 쓴 무기)이 판마다 달라
// 같은 실험체가 무기별로 쪼개진다. 이런 실험체는 무기를 하나로 묶어 "모든 무기"로 집계한다.
// 저장된 원본 weapon_code는 그대로 두고, 조회할 때만 바꿔 읽는다.
export const ALL_WEAPONS_CODE = 0; // weapons 테이블에 없는 코드 (실제 무기 코드는 1부터)
export const ALL_WEAPONS_NAME = "모든 무기";

const ALL_WEAPON_CHARACTERS = [ 27 ]; // 알렉스

// participants(또는 그 별칭)의 무기 코드를 묶음 규칙을 적용해 읽는 SQL 식
export const groupedWeapon = (table: { characterCode: AnySQLiteColumn; weaponCode: AnySQLiteColumn }): SQL<number> =>
  sql<number>`case when ${ table.characterCode } in (${ sql.join(ALL_WEAPON_CHARACTERS.map((code) => sql`${ code }`), sql`, `) }) then ${ ALL_WEAPONS_CODE } else ${ table.weaponCode } end`;

// groupedWeapon과 같은 규칙을 API 기록(DB 밖 값)에 적용한다.
export const groupWeaponCode = (characterCode: number, weaponCode: number) =>
  ALL_WEAPON_CHARACTERS.includes(characterCode) ? ALL_WEAPONS_CODE : weaponCode;

export const weaponName = (code: number, names: Map<number, string>) =>
  code === ALL_WEAPONS_CODE ? ALL_WEAPONS_NAME : names.get(code) ?? `#${ code }`;
