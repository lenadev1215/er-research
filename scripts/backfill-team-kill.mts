// team_kill 열(마이그레이션 0003) 이전에 수집한 경기의 TK를 채운다.
// 사용법: pnpm backfill-tk [최대 경기 수=전부]
// 경기 상세를 다시 조회하므로 수집기와 동시에 돌리지 않는다 (호출량이 두 배가 된다).
// 아직 비어 있는 경기만 고르므로, 중단 후 다시 실행하면 이어서 채운다.
import Database from "better-sqlite3";
import { fetchGame } from "./er-api.mts";

const sqlite = new Database("./data/er.db");
sqlite.pragma("journal_mode = WAL");

const limit = Number(process.argv[ 2 ] ?? Infinity);
const pending = (sqlite.prepare("SELECT DISTINCT game_id FROM participants WHERE team_kill IS NULL").pluck().all() as number[])
  .slice(0, limit);
const update = sqlite.prepare("UPDATE participants SET team_kill = ? WHERE game_id = ? AND team_number = ?");

console.log(`TK가 비어 있는 경기 ${ pending.length }판 (예상 약 ${ Math.ceil(pending.length * 1.1 / 60) }분)`);

let filled = 0;
let missing = 0;
for ( const [ i, gameId ] of pending.entries() ) {
  const records = await fetchGame(gameId);
  if ( records.length === 0 ) {
    missing++;
  } else {
    // teamKill은 팀 단위 값이라 팀 번호별로 한 번씩 쓴다.
    const byTeam = new Map(records.map((r) => [ r.teamNumber, r.teamKill ]));
    sqlite.transaction(() => {
      for ( const [ team, teamKill ] of byTeam ) update.run(teamKill, gameId, team);
    })();
    filled++;
  }
  if ( ( i + 1 ) % 100 === 0 ) console.log(`  ${ i + 1 }/${ pending.length } (채움 ${ filled }, 조회 실패 ${ missing })`);
}

console.log(`완료: 채움 ${ filled }판, 조회 실패 ${ missing }판`);
sqlite.close();
