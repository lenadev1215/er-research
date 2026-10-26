// 전적 분석(/api/report) 응답 형태. 서버와 클라이언트가 함께 쓴다.
// 닉네임·userId·gameId는 어떤 타입에도 넣지 않는다 (화면·로그·Claude 입력으로 새지 않게).
import type { NamedPick } from "@/lib/synergy-aggregate";
import type { Tier } from "@/lib/tier";

// DB(랭크 스쿼드)와 직접 비교할 수 있는지가 모드 구분의 기준이다.
export type ReportMode = "rankSquad" | "normalSquad" | "other";

// TOP3로 끝난 판에서 내 기여가 어땠는지 (lib/report/compare.ts gameImpact).
// carry: 딜량과 KDA가 모두 같은 실험체의 TOP3 판 평균의 1.3배 이상. bus: 둘 다 0.7배 이하.
export type GameImpact = "carry" | "bus";

export type RecentGame = {
  mode: ReportMode;
  rank: number;
  teams: number; // 참가 팀 수. 모드마다 달라 순위의 의미가 다르다
  rp: number | null; // 랭크 경기만 값이 있다
  damage: number;
  pick: NamedPick;
  impact: GameImpact | null; // TOP3가 아니거나, 기준이 없거나, 둘 다 아니면 null
  detail: ImpactDetail | null; // 캐리·버스 판만 있다
};

// 캐리·버스 판의 기록. 배율은 같은 실험체의 TOP3 판 평균 대비 (lib/report/impact.ts).
export type ImpactDetail = {
  kills: number;
  assists: number;
  deaths: number;
  kda: number;
  damageRatio: number | null;
  kdaRatio: number | null;
  teamDamage: number | null; // 내 딜량 포함 팀 3명의 합. 팀 정보를 받지 못했으면 null
};

// 판당 평균 킬·어시스트·데스와 KDA ((킬 + 어시스트) / 데스, lib/report/kda.ts). 소견 입력에만 쓴다.
export type KdaMetrics = {
  kills: number;
  assists: number;
  deaths: number;
  kda: number;
};

// 팀 기여 (lib/report/team.ts). 비율은 0~1, 3인 팀 기준선은 1/3.
export type TeamMetrics = {
  games: number;
  teamKill: number; // 판당 평균 TK (팀 킬)
  killShare: number | null; // 내 킬 / TK. TK가 0이면 null
  involvement: number | null; // (킬 + 어시스트) / TK
  damageGames: number; // 딜 점유율을 낸 판수 (팀 정보가 있는 판)
  damageShare: number | null; // 내 딜량 / 팀 딜량. 팀 정보가 있는 판이 없으면 null
};

// kill: 킬 마무리 쪽 비중이 크다. damage: 딜량 쪽 비중이 크다. balanced: 차이가 작다.
export type TeamRole = "kill" | "damage" | "balanced";

export type ReportTeam = {
  me: TeamMetrics;
  ref: TeamMetrics | null; // 내가 쓴 실험체들의 DB 평균을 판수로 가중한 값. DB 표본이 없으면 null
  role: TeamRole | null; // 딜 점유율이 없으면 null
};

export type MyMetrics = {
  games: number;
  winRate: number;
  top3Rate: number;
  avgRank: number;
  avgRp: number | null; // 랭크 경기가 없으면 null
  avgDamage: number;
  visionScore: number | null; // 시야 점수 평균 (기준 50). DB 분포가 아직 없으면 null
  kda: KdaMetrics;
};

export type DbMetrics = {
  tier: Tier | null; // 최소 판수 미만이면 null (표본 부족)
  games: number;
  top3Rate: number;
  avgRank: number;
  avgDamage: number | null;
  visionScore: number | null; // 이 실험체·무기의 DB 평균 시야 점수. 표본 부족이면 null
  kda: KdaMetrics | null; // 이 실험체·무기의 DB 평균 KDA. 표본 부족이면 null
};

// direct: 랭크 스쿼드끼리 비교. reference: 일반 경기 등이 섞여 참고용
export type CompareBasis = "direct" | "reference";

export type PickComparison = {
  pick: NamedPick;
  me: MyMetrics;
  db: DbMetrics | null; // DB에 이 실험체·무기 기록이 없으면 null
  basis: CompareBasis;
};

export type ComboComparison = {
  pick: NamedPick;
  mates: [ NamedPick, NamedPick ];
  me: Pick<MyMetrics, "games" | "top3Rate" | "avgRank">;
  db: Omit<DbMetrics, "avgDamage" | "visionScore" | "kda"> | null; // 조합 비교에는 시야·KDA를 넣지 않는다
};

// 시야 지표 4개의 평균.
export type VisionMetrics = {
  view: number; // viewContribution 시야 기여
  cam: number; // addTelephotoCamera 카메라 설치
  camRemove: number; // removeTelephotoCamera 카메라 제거
  drone: number; // useReconDrone 정찰 드론
};

// score는 시야 점수 (기준 50, lib/report/vision.ts). DB 분포가 아직 없으면 null
export type VisionSummary = VisionMetrics & { score: number | null };

export type ReportVision = {
  all: VisionSummary;
  top3: { games: number; metrics: VisionSummary | null }; // TOP3로 끝난 판
  rest: { games: number; metrics: VisionSummary | null }; // 그 밖의 판
  ref: VisionSummary | null; // 내가 쓴 실험체들의 DB 평균을 판수로 가중한 값. 비교할 DB 표본이 없으면 null
  top3Ref: VisionSummary | null; // 내 TOP3 판의 실험체들이 TOP3로 끝난 판의 DB 평균 (top3와 비교한다)
};

// 팀 내 역할과 별개인 플레이 스타일 뱃지 (lib/report/compare.ts playstyleOf).
// vision: TOP3 판 시야 점수가 같은 실험체의 TOP3 판 평균보다 높다. survivor: 그러면서 데스도 같은 실험체 평균보다 적다.
export type Playstyle = "vision" | "survivor";

// 시즌 랭크 모스트 실험체 (최대 3개, 판수 많은 순). 시즌 통계에는 무기 구분과 딜량·TK가 없다.
export type SeasonMost = {
  characterCode: number;
  characterName: string;
  games: number;
  winRate: number;
  top3Rate: number;
  maxKills: number;
  // 최근 경기에서 이 실험체를 쓴 판의 평균. 쓰지 않았으면 null
  recent: { games: number; avgDamage: number; avgTeamKill: number } | null;
};

export type ImpactSummary = {
  top3: number; // TOP3로 끝난 판수
  judged: number; // 그중 같은 실험체 평균이 있어 판정한 판수
  carry: number;
  bus: number;
};

export type ReportStats = {
  recent: RecentGame[]; // 오래된 판부터
  overall: MyMetrics;
  picks: PickComparison[];
  combos: ComboComparison[]; // 랭크 스쿼드만
  vision: ReportVision;
  kdaRef: KdaMetrics | null; // 내가 쓴 실험체들의 DB 평균 KDA를 판수로 가중한 값. DB 표본이 없으면 null
  team: ReportTeam;
  impact: ImpactSummary;
  playstyle: Playstyle | null;
  most: SeasonMost[]; // 시즌 통계를 받지 못했거나 랭크 기록이 없으면 빈 배열
  belowDbRange: boolean; // MMR이 DB 표본 구간(다이아몬드 이상)보다 낮거나 랭크 기록이 없다
};

// 스트림 시작 전에 끝나는 오류는 HTTP 상태와 { code }로, 스트림 도중의 오류는 error 이벤트로 온다.
export type ReportErrorCode = "invalid" | "not-found" | "no-games" | "rate-limited" | "busy" | "disabled" | "demo-only" | "upstream" | "advice-failed";

export type ReportEvent =
  | { type: "stats"; stats: ReportStats }
  | { type: "advice"; delta: string }
  | { type: "done" }
  | { type: "error"; code: ReportErrorCode };
