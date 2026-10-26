// 나중에 추가한 열(team_kill: 0003, damage_to_player: 0004)을 기존 수집분에 채운다.
// 사용법: pnpm backfill [최대 경기 수=전부]
// 경기 상세를 다시 조회하므로 수집기와 동시에 돌리지 않는다 (호출량이 두 배가 된다).
// 아직 비어 있는 경기만 고르므로, 중단 후 다시 실행하면 이어서 채운다.
import Database from "better-sqlite3";
import { fetchGame } from "./er-api.mts";

const sqlite = new Database("./data/er.db");
sqlite.pragma("journal_mode = WAL");

const limit = Number(process.argv[ 2 ] ?? Infinity);
const pending = (sqlite.prepare(
  "SELECT DISTINCT game_id FROM participants WHERE team_kill IS NULL OR damage_to_player IS NULL",
).pluck().all() as number[]).slice(0, limit);

// 닉네임을 저장하지 않으므로 참가자는 (경기, 팀, 실험체)로 찾는다. 같은 팀 안에서 실험체는 겹치지 않는다.
const update = sqlite.prepare(
  "UPDATE participants SET team_kill = ?, damage_to_player = ? WHERE game_id = ? AND team_number = ? AND character_code = ?",
);

console.log(`TK·딜량이 비어 있는 경기 ${ pending.length }판 (예상 약 ${ Math.ceil(pending.length * 1.1 / 60) }분)`);

let filled = 0;
let missing = 0;
for ( const [ i, gameId ] of pending.entries() ) {
  const records = await fetchGame(gameId);
  if ( records.length === 0 ) {
    missing++;
  } else {
    sqlite.transaction(() => {
      for ( const r of records ) update.run(r.teamKill, r.damageToPlayer, gameId, r.teamNumber, r.characterNum);
    })();
    filled++;
  }
  if ( ( i + 1 ) % 100 === 0 ) console.log(`  ${ i + 1 }/${ pending.length } (채움 ${ filled }, 조회 실패 ${ missing })`);
}

console.log(`완료: 채움 ${ filled }판, 조회 실패 ${ missing }판`);
sqlite.close();
