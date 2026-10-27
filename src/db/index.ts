import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// 배포 환경(Vercel)은 파일 시스템에 쓸 수 없어, pnpm snapshot으로 만든 사본을 읽기 전용으로 연다.
// ER_DB_PATH가 없으면 로컬 개발용 원본 DB를 쓴다.
const dbPath = process.env.ER_DB_PATH ?? "./data/er.db";
const readonly = process.env.ER_DB_READONLY === "1";

const sqlite = new Database(dbPath, { readonly });
if ( !readonly ) sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
