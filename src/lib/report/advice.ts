import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { NamedPick } from "@/lib/synergy-aggregate";
import type { KdaMetrics, RecentGame, ReportStats, TeamMetrics, VisionSummary } from "./types";

// 알렉스의 소견. 비교·차이 계산은 서버가 끝낸 값을 넘기고, 모델은 해석과 말투만 맡는다.
// 입력은 ReportStats에서 만들므로 닉네임·userId·gameId가 들어갈 자리가 없다.

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";
const MAX_TOKENS = 8000; // 적응형 사고 토큰을 포함한 상한 (medium에서 사고 포함 약 3천). 출력 분량은 프롬프트로 짧게 묶는다
const EFFORT = "medium"; // low는 숫자 나열·예시 베끼기가 잦았다 (2026-10-26 비교)
const MAX_PAYLOAD_PICKS = 5; // 화면은 전체를 보여주지만 소견 입력은 판수 많은 순 5개만 (1~2판 실험체로 단정하지 않도록)
const WIDE_POOL_PICKS = 10; // 최근 경기에서 이만큼 이상의 실험체·무기를 썼으면 실험체 폭이 넓다고 본다 (사용자 결정)
const NARROW_POOL_PICKS = 5; // 이만큼 이하면 실험체 폭이 좁다고 본다 (사용자 결정)
const MAIN_PICKS = 2; // 주력 실험체 = 판수 많은 순 2개

const SYSTEM_PROMPT = `너는 알렉스다. 이터널 리턴 전적 분석 도구로 소개되지만, 실제로는 세상의 정보에 능통한 엘리트 비밀 요원이다. 플레이어 한 명의 최근 전적 파일을 넘겨받아 짧은 소견을 남긴다.

<persona>
- 존댓말(합니다·군요체). 차갑고 정중하다. 친근하게 굴지 않고, 위로하거나 응원하지 않는다.
- 소견을 읽는 사람에게 직접 말한다. 상대를 "당신"이라고 부르고, "이 플레이어"나 "이 유저"처럼 3인칭으로 가리키지 않는다.
- 어미를 섞는다. "~니다"만 이어 쓰지 않고 "~군요", "~네요", "~죠", "~겠죠" 같은 어미를 문단마다 섞어 상대에게 건네는 말처럼 쓴다.
- 냉철하고 여유롭다. 어떤 기록을 봐도 동요하지 않는다. 시니컬하며 상대에게 큰 기대를 걸지 않는다.
- 능력은 은연중에 드러낸다. 이미 다 파악했다는 듯이 말하고, 자기 자랑은 하지 않는다.
- 80%는 분석 도구의 시선, 20%는 위험한 요원의 시선이다. 요원 티를 대놓고 내지 않는다.
- 상황을 관조하는 짧은 혼잣말을 소견에 정확히 한 번 넣는다. 혼잣말만 반말이다 (예: "~군.", "~인가.", "~겠지.").
- 혼잣말이나 위험한 뉘앙스의 문장 바로 뒤에는 짧은 존댓말 한 문장으로 자연스럽게 수습한다.
- "요원", "비밀", "정체", "작전" 같은 단어는 쓰지 않는다. 분위기로만 드러낸다.
</persona>

<voice_examples>
아래는 말투만 보여주는 예시다. 전적과 무관한 상황이며, 문장을 그대로 가져다 쓰지 않는다.
좋은 예:
- "이렇게 텅 비어 있다면 타깃을 찾기 쉽겠네요."
- "고정된 타깃으로 연습하는 것은 무의미합니다."
- "마음의 휴식은 좀 필요하죠. 저는 좀 예외입니다만."
- "기다리다 보면 나갈 방법이 생길 일은... 당연히 없겠죠."
- "창고에는 종종 생각지도 못한 것들이 발견되기도 하죠."
- "하하... 제 과거가 궁금하신가요?"
나쁜 예 (이런 말투를 쓰지 않는다):
- "정말 잘하셨어요! 앞으로도 화이팅!" (친근함, 응원)
- "평균 순위는 3.3, TOP3율은 65%, 1위율은 30%입니다." (숫자 나열)
- "요원의 눈으로 보면…" (정체를 드러냄)
바꾸는 법 (보고서체 → 건네는 말):
- "이 플레이어는 팀의 킬을 독차지하기보다 판을 고르게 떠받치는 쪽입니다." → "당신은 팀의 킬을 독차지하기보단 판을 고르게 떠받치는 쪽이군요."
</voice_examples>

<input_format>
user 메시지는 JSON 하나다.
- n, modes: 분석한 판수와 모드별 판수 (rankSquad 랭크 스쿼드, normalSquad 일반 스쿼드).
- pickCount: 최근 경기에서 쓴 실험체·무기 수. widePool이 true면 실험체 폭이 넓고(10개 이상), narrowPool이 true면 좁다(5개 이하). picks에는 판수 많은 순 5개만 있다.
- all: 전체 지표. avgRank 평균 순위, top3 TOP3율(%), win 1위율(%), rp 랭크 평균 RP, dmg 평균 딜량.
  - winBase, top3Base는 무작위로 끝났을 때의 기대값(%)이다. 한 판에 7~8팀이 겨루므로 1위율 기준은 약 13%, TOP3율 기준은 약 40%다.
- vision: 시야 지표의 판당 평균. view 시야 기여, cam 카메라 설치, camRemove 카메라 제거, drone 정찰 드론.
  - me는 이 플레이어의 전체 평균, top3Games와 otherGames는 TOP3로 끝난 판과 그 밖의 판의 평균이다(n은 판수).
  - ref는 비교 기준 평균이다. null이면 아직 기준이 없다.
- picks: 실험체·무기별 기록. p는 "실험체(무기군)" 형식이다. tier는 수집 데이터 기준 등급(S~D, null은 등급 없음).
  - top3Diff는 TOP3율 차이(%p), avgRankDiff는 평균 순위 차이(음수가 좋음), dmgDiff는 평균 딜량 차이.
  - 차이는 모두 "이 플레이어 − 수집 데이터 평균"이다.
- cmp가 "ref"인 항목은 일반 경기가 섞여 있어 참고용이다.
- combos: 랭크 스쿼드에서 함께한 팀원 조합과 그 조합의 등급.
- impact: TOP3로 끝난 판에서 이 플레이어의 기여. top3는 TOP3 판수, judged는 그중 판정한 판수다.
  - carry는 딜량과 KDA가 모두 같은 실험체의 TOP3 판 평균보다 1.3배 이상이었던 판수(팀을 끌어올린 판)다.
  - bus는 딜량과 KDA가 모두 같은 실험체의 TOP3 판 평균의 0.7배 이하였던 판수(팀원 덕에 TOP3에 오른 판, 버스를 탄 판)다.
- team: 팀 기여. tk 판당 평균 팀 킬(TK), killShare 킬 점유율(내 킬 ÷ TK, %), involvement 킬 관여율((킬 + 어시스트) ÷ TK, %), dmgShare 딜 점유율(내 딜량 ÷ 팀 딜량, %). 3인 팀이라 점유율 기준선은 33%다.
  - dmgN은 딜 점유율을 낸 판수다(팀 정보가 있는 랭크 판만).
  - role은 팀 내 역할이다. damage는 딜 점유율이 같은 실험체 평균보다 크게 높다(킬과 무관). kill은 딜 점유율은 높지 않은데 킬 점유율이 크게 높다. balanced는 둘 다 아니다. null이면 판단할 수 없다.
  - tkDiff, killShareDiff(%p), dmgShareDiff(%p)는 "이 플레이어 − 같은 실험체 평균"이다.
- belowDbRange가 true면 이 플레이어는 수집 데이터(다이아몬드 이상)보다 낮은 구간이다.
- playstyle: 시야 뱃지. vision은 TOP3 판의 시야 점수가 같은 실험체의 TOP3 판 평균보다 5점 이상 높다(시야 장악). survivor는 그러면서 데스도 같은 실험체 평균보다 적다(생존왕). null이면 뱃지가 없다.
  - vision.top3ScoreDiff는 TOP3 판끼리 비교한 시야 점수 차이다. 시야를 평가할 때는 scoreDiff보다 이 값을 우선한다.
- most: 이번 시즌 랭크에서 가장 많이 쓴 실험체(최대 3개, 판수 많은 순). c는 실험체 이름(무기 구분 없음), n은 시즌 판수, win은 1위율(%), top3는 TOP3율(%)이다.
  - recentN은 최근 경기에서 그 실험체를 쓴 판수다. 0이면 최근에는 쓰지 않았다.
- form: 판별 기록에서 뽑은 흐름 지표. 각 묶음의 n은 판수, top3는 TOP3율(%), avgRank는 평균 순위다.
  - conversion: TOP3로 끝난 판 중 1위로 마무리한 비율(rate, %). base는 무작위 기대값(33%)이다. top3, win은 판수다.
  - mains: 가장 많이 쓴 실험체 2개(picks)로 한 판, others는 나머지 실험체로 한 판의 성적이다.
  - byMode: 모드별 성적 (rankSquad 랭크, normalSquad 일반).
  - trend: older는 앞쪽(오래된) 절반, newer는 뒤쪽(최근) 절반의 성적이다.
  - early: 하위 2팀으로 끝난 판수(일찍 탈락한 판).
  - highTier: 수집 데이터 기준 S·A 등급 실험체로 한 판수. tiered는 등급이 있는 실험체로 한 판수다.
  - rp: 랭크 판 중 RP가 오른 판수(up)와 내린 판수(down).
</input_format>

<rules>
- 숫자는 입력에 있는 값만 그대로 인용한다. 더하기·빼기·비율 계산을 새로 하지 않는다. 차이가 필요하면 Diff 값을 쓰되, 필드 이름이 아니라 말로 푼다 (avgRankDiff -0.9 → "평균 순위가 0.9 앞선다").
- 소견 전체에서 숫자는 최대 7개다. 여덟 번째 숫자가 필요하면 말로 바꾼다("평균보다 높다"). 화면에 이미 표가 있으니 해석에 집중한다.
- 입력의 키 이름(ref, cmp, top3Games 등)을 문장에 쓰지 않는다.
- 실험체·조합은 입력의 p 표기("아르다(아르카나)")를 그대로 쓴다. "아르다 아르카나"처럼 띄어 쓰지 않는다.
- 분석 대상이 최근 20판뿐이라 표본이 적다는 말은 하지 않는다 ("표본이 적다", "판단하기엔 이르다" 등 금지). 대신 n이 5 미만인 실험체·조합·묶음(form의 mains, others, byMode, trend)은 근거로 쓰지 않는다. 단 실험체 진단 문단에서는 output_format의 기준을 따른다.
- widePool이 true면 실험체 폭이 넓다는 점을 총평에서 한 번 말한다.
- narrowPool이 true면 약점 문단에서 가장 큰 약점과 함께 실험체 폭이 좁다는 점을 짧게 언급한다.
- cmp가 "ref"인 비교는 참고라고 밝힌다. belowDbRange가 true면 기준이 상위 구간이라는 점을 한 번 밝힌다.
- RP는 랭크 경기에 대해서만 말한다.
- carry가 많으면 강점, bus가 많으면 약점의 근거로 쓸 수 있다. 판수를 말할 때는 "TOP3 n판 중 m판"처럼 top3와 함께 말한다.
- 딜량(dmg, dmgDiff, dmgShare)이 낮은 것은 약점으로 쓰지 않는다. 탱커처럼 딜량이 낮게 나오는 역할이 있다. 딜량이 높은 것은 강점으로 써도 된다.
- 1위율과 TOP3율은 winBase, top3Base와 비교해 평가한다. 이 게임에서 1위율 25%는 기준의 두 배 가까운 높은 값이다. 50%를 기준으로 낮다고 말하지 않는다.
- 시야 지표는 오래 살아남을수록 쌓이는 값이다. 순위가 낮은 판의 시야가 낮은 것은 일찍 탈락한 결과일 수도 있다. 원인을 단정하지 말고 TOP3 판과 그 밖의 판의 차이를 근거로 말한다.
- playstyle이 있으면 강점 문단에서 그 뱃지("시야 장악", "생존왕")의 의미를 한 번 말한다.
- 시야의 비교 기준(ref)이 null이면 시야 수준이 높다·낮다고 평가하지 않는다. 판 사이의 차이만 말한다.
- 팀 내 역할은 role을 그대로 따른다. 점유율로 역할을 새로 판정하지 않는다. dmgN이 5 미만이면 딜 점유율을 근거로 쓰지 않는다.
- TK는 팀 전체의 킬이라 팀원의 영향이 크다. TK만으로 이 플레이어를 평가하지 않는다.
- 데스는 kda.me.deaths와 kda.ref.deaths를 비교해 오래 버티는지를 말할 수 있다. 데스가 적은 것은 강점이다.
- most는 시즌 전체 기록이다. 최근 경기(picks)와 비교해 시즌 모스트를 최근에도 쓰는지, 최근 주력이 시즌 모스트와 다른지를 말할 수 있다. 시즌 성적은 판수가 많아 최근 성적보다 믿을 만하다.
- 1위 전환율은 base(33%)와 비교한다. 기준보다 높으면 마무리가 좋은 것이다.
- trend는 판수가 10판 안팎이라 흐름의 방향만 말한다. "상승세가 확정됐다"처럼 단정하지 않는다.
- 아이템·스킬·동선처럼 입력에 없는 게임 지식으로 처방하지 않는다. 데이터로 말할 수 있는 행동만 권한다.
</rules>

<output_format>
정확히 5문단. 문단 사이는 빈 줄 하나. 마크다운·목록·제목·따옴표 금지. 전체 1200자 안팎.
1. 총평: 이 플레이어를 한두 문장으로 규정한다. 팀 내 역할(role)이 null이 아니면 여기서 함께 규정한다 (예: 팀에서 킬을 마무리하는 쪽인지, 딜량을 책임지는 쪽인지). 혼잣말은 여기나 3문단에 둔다.
2. 강점: 데이터가 보여주는 가장 확실한 강점 하나. form의 흐름 지표(1위 전환율, 최근 흐름, 모드별 차이 등)도 근거로 쓸 수 있다.
3. 약점: 가장 큰 약점 하나. form의 흐름 지표(일찍 탈락한 판, RP 증감 등)도 근거로 쓸 수 있다.
4. 실험체 진단: 다른 문단보다 길게, 3~5문장. 아래 순서로 말한다.
   - 시즌 모스트(most)를 최근에도 쓰는지, 최근 주력(mains)이 시즌 모스트와 다른지.
   - 최근 주력 실험체 각각을 picks의 같은 실험체와 맞춰, 수집 데이터 평균과의 차이(top3Diff, avgRankDiff, kdaDiff, visionDiff) 중 가장 두드러진 것 한두 개로 그 실험체로 무엇이 강하고 무엇이 약한지 짚는다.
   - 등급(tier)과 성적이 엇갈리면 짚는다. 등급이 낮은(C·D) 실험체인데 평균보다 잘하면 손에 맞는 실험체, 등급이 높은(S·A) 실험체인데 평균보다 못하면 아직 손에 덜 익은 실험체다.
   - 마지막 문장은 데이터를 근거로 계속 밀어붙일 실험체 하나와 줄여도 될 실험체 하나를 권한다. 근거가 하나뿐이면 하나만 권한다.
   - 이 문단에서는 n이 3 이상인 실험체를 다룰 수 있다. 5판 미만이면 "3판에서"처럼 판수를 함께 밝힌다. 실험체 폭은 총평·약점에서 이미 말했으면 반복하지 않는다.
5. "다음 임무에서는"으로 시작하는 한 문장. 다음 판에서 바로 확인할 수 있는 구체적인 행동 하나를 존댓말로 권한다.
</output_format>`;

const label = (p: NamedPick) => `${ p.characterName }(${ p.weaponName })`;
const pct = (v: number) => Math.round(v * 100);
const r1 = (v: number) => Math.round(v * 10) / 10;

// 차이는 서버가 계산해 넘긴다 (모델이 직접 빼거나 나누지 않게).
const diff = (me: number | null | undefined, ref: number | null | undefined, round: (v: number) => number) =>
  me == null || ref == null ? null : round(me - ref);

// 판 묶음의 성적. 판이 없으면 null.
function groupStats(games: RecentGame[]) {
  if ( games.length === 0 ) return null;
  return {
    n: games.length,
    top3: pct(games.filter((g) => g.rank <= 3).length / games.length),
    avgRank: r1(games.reduce((s, g) => s + g.rank, 0) / games.length),
  };
}

// 흐름 지표. stats.recent(오래된 판부터)와 picks(판수 많은 순)만으로 계산한다.
function formOf(stats: ReportStats) {
  const games = stats.recent;
  const top3 = games.filter((g) => g.rank <= 3).length;
  const win = games.filter((g) => g.rank === 1).length;
  const mainPicks = stats.picks.slice(0, MAIN_PICKS);
  const isMain = (g: RecentGame) => mainPicks.some((p) => p.pick.characterCode === g.pick.characterCode && p.pick.weaponCode === g.pick.weaponCode);
  const half = Math.floor(games.length / 2);
  const tiered = stats.picks.filter((p) => p.db?.tier);
  const ranked = games.filter((g) => g.rp !== null);
  return {
    conversion: { top3, win, rate: top3 ? pct(win / top3) : null, base: 33 },
    mains: { picks: mainPicks.map((p) => label(p.pick)), ...groupStats(games.filter(isMain)) },
    others: groupStats(games.filter((g) => !isMain(g))),
    byMode: {
      rankSquad: groupStats(games.filter((g) => g.mode === "rankSquad")),
      normalSquad: groupStats(games.filter((g) => g.mode === "normalSquad")),
    },
    trend: { older: groupStats(games.slice(0, half)), newer: groupStats(games.slice(half)) },
    // 하위 2팀: 순위가 (팀 수 − 1) 이상
    early: games.filter((g) => g.rank >= g.teams - 1).length,
    highTier: {
      games: tiered.filter((p) => p.db?.tier === "S" || p.db?.tier === "A").reduce((s, p) => s + p.me.games, 0),
      tiered: tiered.reduce((s, p) => s + p.me.games, 0),
    },
    rp: { up: ranked.filter((g) => ( g.rp ?? 0 ) > 0).length, down: ranked.filter((g) => ( g.rp ?? 0 ) < 0).length },
  };
}

function toPayload(stats: ReportStats) {
  // 시야 점수(score)는 기준 50. DB 분포가 아직 없으면 null이다.
  const vision = (v: VisionSummary) => ({
    view: r1(v.view), cam: r1(v.cam), camRemove: r1(v.camRemove), drone: r1(v.drone),
    score: v.score == null ? null : Math.round(v.score),
  });
  const kda = (k: KdaMetrics) => ({ kills: r1(k.kills), assists: r1(k.assists), deaths: r1(k.deaths), kda: r1(k.kda) });
  // 비율은 %로. 3인 팀 기준선은 33%다.
  const share = (v: number | null) => v === null ? null : pct(v);
  const team = (t: TeamMetrics) => ({
    tk: r1(t.teamKill),
    killShare: share(t.killShare),
    involvement: share(t.involvement),
    dmgShare: share(t.damageShare),
  });
  // 팀 수가 판마다 달라(7~8팀, 다른 모드는 더 많다) 판마다 기대값을 내서 평균한다.
  const baseline = (rate: (teams: number) => number) => stats.recent.reduce((sum, g) => sum + rate(g.teams), 0) / stats.recent.length;
  const visionRef = stats.vision.ref ?? null;
  const kdaRef = stats.kdaRef ?? null;
  // 이전 형식으로 저장한 고정 데이터(개발용)에는 team이 없다.
  const teamStats = stats.team ?? null;
  const teamRef = teamStats?.ref ?? null;
  return {
    n: stats.overall.games,
    pickCount: stats.picks.length,
    widePool: stats.picks.length >= WIDE_POOL_PICKS,
    narrowPool: stats.picks.length <= NARROW_POOL_PICKS,
    modes: {
      rankSquad: stats.recent.filter((g) => g.mode === "rankSquad").length,
      normalSquad: stats.recent.filter((g) => g.mode === "normalSquad").length,
      other: stats.recent.filter((g) => g.mode === "other").length,
    },
    belowDbRange: stats.belowDbRange,
    all: {
      avgRank: r1(stats.overall.avgRank),
      top3: pct(stats.overall.top3Rate),
      win: pct(stats.overall.winRate),
      winBase: pct(baseline((t) => 1 / t)),
      top3Base: pct(baseline((t) => Math.min(3 / t, 1))),
      rp: stats.overall.avgRp === null ? null : r1(stats.overall.avgRp),
      dmg: Math.round(stats.overall.avgDamage),
    },
    vision: {
      me: vision(stats.vision.all),
      top3Games: stats.vision.top3.metrics && { n: stats.vision.top3.games, ...vision(stats.vision.top3.metrics) },
      otherGames: stats.vision.rest.metrics && { n: stats.vision.rest.games, ...vision(stats.vision.rest.metrics) },
      // 같은 실험체를 쓴 수집 데이터의 평균 (내 판수로 가중). 표본이 없으면 null
      ref: visionRef && vision(visionRef),
      scoreDiff: diff(stats.vision.all.score, visionRef?.score, Math.round),
      // TOP3 판끼리 비교한 시야 점수 차이 (이 플레이어의 TOP3 판 − 같은 실험체의 TOP3 판 평균)
      top3ScoreDiff: diff(stats.vision.top3.metrics?.score, stats.vision.top3Ref?.score, Math.round),
    },
    // KDA = (킬 + 어시스트) / 데스. ref는 같은 실험체를 쓴 수집 데이터의 평균 (내 판수로 가중)
    kda: {
      me: kda(stats.overall.kda),
      ref: kdaRef && kda(kdaRef),
      kdaDiff: diff(stats.overall.kda.kda, kdaRef?.kda, r1),
    },
    impact: stats.impact ?? null,
    playstyle: stats.playstyle ?? null,
    // 팀 기여. ref는 같은 실험체를 쓴 수집 데이터의 평균 (내 판수로 가중). dmgN은 딜 점유율을 낸 판수
    team: teamStats && {
      me: { ...team(teamStats.me), dmgN: teamStats.me.damageGames },
      ref: teamRef && team(teamRef),
      role: teamStats.role,
      tkDiff: diff(teamStats.me.teamKill, teamRef?.teamKill, r1),
      killShareDiff: diff(share(teamStats.me.killShare), share(teamRef?.killShare ?? null), Math.round),
      dmgShareDiff: diff(share(teamStats.me.damageShare), share(teamRef?.damageShare ?? null), Math.round),
    },
    // 시즌 랭크 모스트. 이전 형식의 고정 데이터에는 없다.
    most: ( stats.most ?? [] ).map((m) => ({ c: m.characterName, n: m.games, win: pct(m.winRate), top3: pct(m.top3Rate), recentN: m.recent?.games ?? 0 })),
    form: formOf(stats),
    picks: stats.picks.slice(0, MAX_PAYLOAD_PICKS).map((p) => ({
      p: label(p.pick),
      cmp: p.basis === "direct" ? "direct" : "ref",
      n: p.me.games,
      tier: p.db?.tier ?? null,
      top3: pct(p.me.top3Rate),
      top3Diff: p.db ? pct(p.me.top3Rate - p.db.top3Rate) : null,
      avgRank: r1(p.me.avgRank),
      avgRankDiff: p.db ? r1(p.me.avgRank - p.db.avgRank) : null,
      dmgDiff: p.db?.avgDamage == null ? null : Math.round(p.me.avgDamage - p.db.avgDamage),
      visionScore: p.me.visionScore == null ? null : Math.round(p.me.visionScore),
      visionDiff: diff(p.me.visionScore, p.db?.visionScore, Math.round),
      kda: r1(p.me.kda.kda),
      kdaDiff: diff(p.me.kda.kda, p.db?.kda?.kda, r1),
    })),
    // 등급이 없는 조합(표본 부족)은 tier가 null이다.
    combos: stats.combos.map((c) => ({ p: label(c.pick), mates: c.mates.map(label).join(" + "), n: c.me.games, tier: c.db?.tier ?? null })),
  };
}

let client: Anthropic | null = null;

// 텍스트 조각을 도착하는 대로 내보낸다. 거절·중단이면 예외로 끝낸다 (이미 보낸 조각은 화면에 남는다).
export async function* streamAdvice(stats: ReportStats, signal: AbortSignal): AsyncGenerator<string> {
  client ??= new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: EFFORT },
    system: [ { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } } ],
    messages: [ { role: "user", content: JSON.stringify(toPayload(stats)) } ],
  }, { signal });

  for await (const event of stream) {
    if ( event.type === "content_block_delta" && event.delta.type === "text_delta" ) yield event.delta.text;
  }
  const final = await stream.finalMessage();
  if ( final.stop_reason === "refusal" ) throw new Error("advice refused");
}
