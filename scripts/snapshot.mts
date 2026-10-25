// 배포용 읽기 전용 DB 사본을 만든다: data/er.db → data/er-public.db
// 사용법: pnpm snapshot
// 닉네임이 든 crawl_users 등은 허용 목록에 없으므로 사본에서 지운다. 수집기가 돌고 있어도 실행할 수 있다.
import Database from "better-sqlite3";
import { rmSync } from "node:fs";

const SOURCE = "./data/er.db";
const TARGET = "./data/er-public.db";

// 화면 집계에 필요한 테이블만 남긴다. 새 테이블을 공개하려면 여기에 직접 추가해야 한다.
const PUBLIC_TABLES = new Set([ "games", "participants", "characters", "weapons", "traits" ]);

rmSync(TARGET, { force: true });

const source = new Database(SOURCE, { readonly: true });
source.prepare("VACUUM INTO ?").run(TARGET);
source.close();

const target = new Database(TARGET);
const tables = target.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").pluck().all() as string[];
const dropped = tables.filter((name) => !PUBLIC_TABLES.has(name));
for ( const name of dropped ) target.exec(`DROP TABLE "${ name }"`);

// 지운 테이블의 페이지가 파일에 남지 않도록 다시 압축하고, 읽기 전용 환경에서 WAL 파일 없이 열리게 한다.
target.pragma("journal_mode = DELETE");
target.exec("VACUUM");

const count = (table: string) => target.prepare(`SELECT count(*) FROM ${ table }`).pluck().get() as number;
console.log(`사본 생성: ${ TARGET } (경기 ${ count("games") }판, 참가자 ${ count("participants") }명)`);
console.log(`제외한 테이블: ${ dropped.join(", ") || "없음" }`);
target.close();
