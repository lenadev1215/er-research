// 메타 적재: 실험체·특성·무기 코드에 한국어 이름을 붙여 DB에 넣는다.
// 사용법: pnpm load-meta
// API의 Character·Trait 메타는 갱신이 멈춰 있거나 빠진 항목이 있어 목록은 l10n을 기준으로 한다.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import { characters, traits, weapons } from "../src/db/schema.ts";
import { WEAPON_CODES } from "../src/db/weapon-codes.ts";

process.loadEnvFile(".env.local");

const API_BASE = "https://open-api.bser.io";
const API_KEY = process.env.ER_API_KEY;
const REQUEST_INTERVAL_MS = 1100;

if ( !API_KEY ) {
  throw new Error("ER_API_KEY가 .env.local에 없습니다.");
}

type TraitMeta = { code: number; traitGroup: string; traitType: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callApi<T>(path: string): Promise<T> {
  const res = await fetch(`${ API_BASE }${ path }`, { headers: { "x-api-key": API_KEY! } });
  await sleep(REQUEST_INTERVAL_MS);
  const body = (await res.json()) as { code: number; message: string; data: T };
  if ( body.code !== 200 ) {
    throw new Error(`API 오류 ${ body.code } (${ body.message }): ${ path }`);
  }
  return body.data;
}

// l10n 파일은 한 줄에 "키┃값" 형식이다.
async function loadL10n(): Promise<Map<string, string>> {
  const { l10Path } = await callApi<{ l10Path: string }>("/v1/l10n/Korean");
  const text = await (await fetch(l10Path)).text();
  const entries = new Map<string, string>();
  for ( const line of text.split("\n") ) {
    const sep = line.indexOf("┃");
    if ( sep > 0 ) entries.set(line.slice(0, sep), line.slice(sep + 1).trim());
  }
  return entries;
}

// Trait 메타에는 특성 계열(73xxxxx)과 일부 특성이 빠져 있다. l10n 이름 목록과 합집합을 쓰고,
// 메타에 없는 특성의 핵심/보조는 코드 규칙으로 추론한다: 세 번째 자리 0 = 핵심, 1 = 보조
// (메타의 일반 특성 34개로 검증, 예외 없음). 계열은 같은 앞 두 자리의 메타 값을 빌리고, 없으면 null.
function buildTraitRows(l10n: Map<string, string>, traitMeta: TraitMeta[]) {
  const metaByCode = new Map(traitMeta.map((t) => [ t.code, t ]));
  const groupByPrefix = new Map(traitMeta.map((t) => [ String(t.code).slice(0, 2), t.traitGroup ]));

  const codes = new Set(traitMeta.map((t) => t.code));
  for ( const key of l10n.keys() ) {
    const match = key.match(/^Trait\/Name\/(\d+)$/);
    if ( match ) codes.add(Number(match[ 1 ]));
  }

  return [ ...codes ].map((code) => {
    const meta = metaByCode.get(code);
    const digits = String(code);
    return {
      code,
      name: l10n.get(`Trait/Name/${ code }`) ?? digits,
      group: meta?.traitGroup ?? groupByPrefix.get(digits.slice(0, 2)) ?? null,
      type: meta?.traitType ?? (digits[ 2 ] === "0" ? "Core" : "Sub"),
    };
  });
}

async function main() {
  const l10n = await loadL10n();
  const traitMeta = await callApi<TraitMeta[]>("/v1/data/Trait");

  const characterRows = [ ...l10n ]
    .map(([ key, name ]) => ({ match: key.match(/^Character\/Name\/(\d+)$/), name }))
    .filter(({ match }) => match && match[ 1 ] !== "0") // 0은 "무작위"
    .map(({ match, name }) => ({ code: Number(match![ 1 ]), name }));

  const traitRows = buildTraitRows(l10n, traitMeta);

  const weaponRows = WEAPON_CODES.map((w) => ({
    ...w,
    name: l10n.get(`MasteryType/${ w.masteryType }`) ?? w.masteryType,
  }));

  const sqlite = new Database("./data/er.db");
  const db = drizzle(sqlite);
  db.transaction((tx) => {
    tx.insert(characters).values(characterRows)
      .onConflictDoUpdate({ target: characters.code, set: { name: sql`excluded.name` } }).run();
    tx.insert(traits).values(traitRows)
      .onConflictDoUpdate({
        target: traits.code,
        set: { name: sql`excluded.name`, group: sql`excluded."group"`, type: sql`excluded.type` },
      }).run();
    tx.insert(weapons).values(weaponRows)
      .onConflictDoUpdate({
        target: weapons.code,
        set: { name: sql`excluded.name`, masteryType: sql`excluded.mastery_type` },
      }).run();
  });
  sqlite.close();

  console.log(`실험체 ${ characterRows.length }, 특성 ${ traitRows.length }, 무기 ${ weaponRows.length } 적재 완료`);
}

main();
