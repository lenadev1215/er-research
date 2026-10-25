import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// 랭크 스쿼드 경기 1판 (matchingMode 3, matchingTeamMode 3만 수집)
export const games = sqliteTable(
  "games",
  {
    id: integer("id").primaryKey(), // API gameId
    seasonId: integer("season_id").notNull(),
    versionMajor: integer("version_major").notNull(),
    versionMinor: integer("version_minor").notNull(),
    startedAt: text("started_at").notNull(), // ISO 8601, API startDtm 그대로
    teamCount: integer("team_count").notNull(), // 경기마다 다름. 1위율 기준선 계산용
    avgMmr: integer("avg_mmr").notNull(), // API mmrAvg
  },
  (t) => [ index("games_season_idx").on(t.seasonId, t.versionMajor, t.versionMinor) ],
);

// 경기 참가자. 같은 실험체가 다른 팀에 중복될 수 있어 대리 키를 쓴다.
// 개인 식별 정보(닉네임, userId)는 저장하지 않는다.
export const participants = sqliteTable(
  "participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
    teamNumber: integer("team_number").notNull(),
    gameRank: integer("game_rank").notNull(), // 팀 최종 순위
    characterCode: integer("character_code").notNull(), // API characterNum
    weaponCode: integer("weapon_code").notNull(), // API bestWeapon
    coreTraitCode: integer("core_trait_code").notNull(), // API traitFirstCore
    mmrBefore: integer("mmr_before").notNull(), // 티어 구간 판별용
    mmrGain: integer("mmr_gain").notNull(), // RP 획득량
    teamKill: integer("team_kill"), // API teamKill. 팀 단위 값이라 같은 팀은 모두 같다. 0003 이전 수집분은 채우기 전까지 null
    preMade: integer("pre_made").notNull(), // API preMade. 의미 확인 전까지 원본 값 보존
  },
  (t) => [
    index("participants_game_team_idx").on(t.gameId, t.teamNumber),
    index("participants_pick_idx").on(t.characterCode, t.weaponCode, t.coreTraitCode),
  ],
);

// 메타: 이름은 l10n(Korean)에서 가져온다. API의 Character 메타는 갱신이 멈춰 있어 쓰지 않는다.
export const characters = sqliteTable("characters", {
  code: integer("code").primaryKey(),
  name: text("name").notNull(),
});

export const weapons = sqliteTable("weapons", {
  code: integer("code").primaryKey(), // bestWeapon 숫자 코드
  masteryType: text("mastery_type").notNull(), // 예: TwoHandSword (l10n MasteryType 키)
  name: text("name").notNull(),
});

export const traits = sqliteTable("traits", {
  code: integer("code").primaryKey(),
  name: text("name").notNull(),
  group: text("group"), // traitGroup, 예: Havoc. 메타에 계열이 없는 특성은 null
  type: text("type").notNull(), // Core | Sub
});

// 수집 대기열. 서버 내부 전용이며 화면·API 응답으로 절대 내보내지 않는다.
// 경기 상세에는 닉네임만 있어 닉네임 → userId 조회가 필요하다.
export const crawlUsers = sqliteTable(
  "crawl_users",
  {
    nickname: text("nickname").primaryKey(),
    userId: text("user_id"), // 조회 전에는 null
    lastMmr: integer("last_mmr"), // 마지막으로 본 MMR. 수집 우선순위(낮은 구간부터)에 쓴다
    lastCrawledAt: text("last_crawled_at"), // null이면 아직 수집 전
    createdAt: text("created_at").notNull(),
  },
  (t) => [ index("crawl_users_queue_idx").on(t.lastCrawledAt, t.lastMmr) ],
);
