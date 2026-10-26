import "server-only";
import { db } from "@/db";
import { characters, weapons } from "@/db/schema";
import { pickTierLookup } from "@/lib/pick-tier";
import { getSynergy } from "@/lib/synergy";
import { comboKey, type NamedPick, type Pick, type SynergyCombo } from "@/lib/synergy-aggregate";
import { assignTiers, type Tier } from "@/lib/tier";
import { weaponName } from "@/lib/weapon-groups";
import type { RecentRecord, SeasonCharacterStat } from "./recent-games";
import type { TeamInfo } from "./teammates";
import type { ComboComparison, DbMetrics, GameImpact, ImpactSummary, KdaMetrics, Playstyle, SeasonMost, MyMetrics, PickComparison, RecentGame, ReportStats, ReportTeam, TeamMetrics, VisionMetrics, VisionSummary } from "./types";
import { loadKdaBaseline, toKda } from "./kda";
import { loadImpactBaseline, type ImpactBase } from "./impact";
import { loadTeamBaseline, teamRole, toTeamMetrics } from "./team";
import { loadVisionBaseline, type VisionBaseline } from "./vision";

// 최근 경기를 DB(랭크 스쿼드, 다이아몬드 이상) 집계와 비교해 화면용 통계와 Claude 입력을 만든다.

const MAX_COMBOS = 5;
const COMBO_MIN_GAMES = 10; // 이보다 적은 DB 조합은 등급을 비교하지 않는다 (화면 기본값 1판과 별개)
const DB_MMR_MIN = 5000; // 수집 대상 하한 (scripts/collect.mts DIAMOND_MIN)

const VISION_EDGE = 5; // TOP3 판 시야 점수가 같은 실험체 TOP3 판 평균보다 이만큼 높으면 시야 장악 (사용자 결정, 50±15 척도)
const PLAYSTYLE_MIN_TOP3 = 3; // TOP3 판이 이보다 적으면 시야 뱃지를 판정하지 않는다
const CARRY_RATIO = 1.3; // 딜량과 KDA가 모두 같은 실험체의 TOP3 판 평균의 이 배수 이상이면 캐리 (사용자 결정, DB TOP3 판의 약 8%)
const BUS_RATIO = 0.7; // 둘 다 이 배수 이하면 버스 (DB TOP3 판의 약 16%)

const pickKey = (p: Pick) => `${ p.characterCode }:${ p.weaponCode }`;

function myMetrics(games: RecentRecord[], vision: VisionBaseline): MyMetrics {
  const n = games.length;
  const visionAvg = visionAverage(games);
  const ranked = games.filter((g) => g.rp !== null);
  return {
    games: n,
    winRate: games.filter((g) => g.rank === 1).length / n,
    top3Rate: games.filter((g) => g.rank <= 3).length / n,
    avgRank: games.reduce((s, g) => s + g.rank, 0) / n,
    avgRp: ranked.length ? ranked.reduce((s, g) => s + ( g.rp ?? 0 ), 0) / ranked.length : null,
    avgDamage: games.reduce((s, g) => s + g.damage, 0) / n,
    visionScore: visionAvg && vision.score(visionAvg),
    kda: toKda(
      games.reduce((s, g) => s + g.kills, 0) / n,
      games.reduce((s, g) => s + g.assists, 0) / n,
      games.reduce((s, g) => s + g.deaths, 0) / n,
    ),
  };
}

function visionAverage(games: RecentRecord[]): VisionMetrics | null {
  if ( games.length === 0 ) return null;
  const avg = (pick: (v: VisionMetrics) => number) => games.reduce((sum, g) => sum + pick(g.vision), 0) / games.length;
  return { view: avg((v) => v.view), cam: avg((v) => v.cam), camRemove: avg((v) => v.camRemove), drone: avg((v) => v.drone) };
}

const withScore = (v: VisionMetrics | null, vision: VisionBaseline): VisionSummary | null => v && { ...v, score: vision.score(v) };

// 내가 쓴 판마다 그 실험체·무기의 DB 평균을 가져와 판수로 가중한다. DB 표본이 없는 판은 뺀다.
function visionReference(records: RecentRecord[], pickOf: VisionBaseline[ "pick" ]): VisionMetrics | null {
  const refs = records.flatMap((r) => {
    const v = pickOf(r.characterCode, r.weaponCode);
    return v ? [ v ] : [];
  });
  if ( refs.length === 0 ) return null;
  const avg = (key: keyof VisionMetrics) => refs.reduce((sum, v) => sum + v[ key ], 0) / refs.length;
  return { view: avg("view"), cam: avg("cam"), camRemove: avg("camRemove"), drone: avg("drone") };
}

// visionReference와 같은 방식: 판마다 그 실험체·무기의 DB 평균을 가져와 판수로 가중한다.
function kdaReference(records: RecentRecord[], kdaOf: (c: number, w: number) => KdaMetrics | null): KdaMetrics | null {
  const refs = records.flatMap((r) => {
    const k = kdaOf(r.characterCode, r.weaponCode);
    return k ? [ k ] : [];
  });
  if ( refs.length === 0 ) return null;
  const avg = (key: "kills" | "assists" | "deaths") => refs.reduce((sum, k) => sum + k[ key ], 0) / refs.length;
  return toKda(avg("kills"), avg("assists"), avg("deaths"));
}

// 팀 기여. 내 기록은 합의 비율로, 기준은 판마다 그 실험체·무기의 DB 평균을 판수로 가중한다.
// 딜 점유율 기준은 딜 점유율을 낸 판(팀 정보가 있는 판)으로만 가중한다.
function teamSummary(records: RecentRecord[], teams: Map<number, TeamInfo>, teamOf: (c: number, w: number) => TeamMetrics | null): ReportTeam {
  // records는 비어 있지 않으므로 me는 항상 있다.
  const me = toTeamMetrics(records.map((r, i) => ({
    kills: r.kills,
    assists: r.assists,
    teamKill: r.teamKill,
    damage: r.damage,
    teamDamage: teams.get(i)?.damage ?? null,
  }))) as TeamMetrics;

  const refs = records.map((r, i) => ({ ref: teamOf(r.characterCode, r.weaponCode), hasDamage: teams.get(i)?.damage != null }));
  const avg = (items: TeamMetrics[], pick: (t: TeamMetrics) => number | null) => {
    const values = items.flatMap((t) => {
      const v = pick(t);
      return v === null ? [] : [ v ];
    });
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const all = refs.flatMap((x) => ( x.ref ? [ x.ref ] : [] ));
  const damaged = refs.flatMap((x) => ( x.ref && x.hasDamage ? [ x.ref ] : [] ));
  const ref: TeamMetrics | null = all.length === 0 ? null : {
    games: all.length,
    teamKill: avg(all, (t) => t.teamKill) ?? 0,
    killShare: avg(all, (t) => t.killShare),
    involvement: avg(all, (t) => t.involvement),
    damageGames: damaged.length,
    damageShare: avg(damaged, (t) => t.damageShare),
  };
  return { me, ref, role: teamRole(me, ref) };
}

// TOP3 판만 판정한다. 같은 실험체의 TOP3 판 평균과 비교하므로 (lib/report/impact.ts) 딜량이 원래 낮은 탱커도 같은 잣대로 본다.
// 캐리·버스 모두 비교할 수 있는 지표가 전부 기준을 넘어야 한다. 비교할 지표가 없으면 판정하지 않는다.
function gameImpact(r: RecentRecord, base: ImpactBase): GameImpact | null | undefined {
  if ( r.rank > 3 ) return null;
  const ratios = [
    base.damage ? r.damage / base.damage : null,
    base.kda ? toKda(r.kills, r.assists, r.deaths).kda / base.kda : null,
  ].filter((v): v is number => v !== null);
  if ( ratios.length === 0 ) return undefined; // 판정 불가
  if ( ratios.every((v) => v >= CARRY_RATIO) ) return "carry";
  if ( ratios.every((v) => v <= BUS_RATIO) ) return "bus";
  return null;
}

// 시야 뱃지. TOP3 판끼리 비교해 생존 시간의 영향을 덜어 낸다. 데스는 전체 판 평균을 같은 실험체 평균과 비교한다.
function playstyleOf(top3Games: number, top3: VisionSummary | null, top3Ref: VisionSummary | null, deaths: number, refDeaths: number | null): Playstyle | null {
  if ( top3Games < PLAYSTYLE_MIN_TOP3 || top3?.score == null || top3Ref?.score == null ) return null;
  if ( top3.score - top3Ref.score < VISION_EDGE ) return null;
  return refDeaths !== null && deaths < refDeaths ? "survivor" : "vision";
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for ( const item of items ) {
    const k = keyOf(item);
    map.set(k, [ ...( map.get(k) ?? [] ), item ]);
  }
  return map;
}

export function buildReport(records: RecentRecord[], teams: Map<number, TeamInfo>, seasonMost: SeasonCharacterStat[]): ReportStats {
  const characterNames = new Map(db.select().from(characters).all().map((c) => [ c.code, c.name ]));
  const weaponNames = new Map(db.select().from(weapons).all().map((w) => [ w.code, w.name ]));
  const named = (p: Pick): NamedPick => ({
    ...p,
    characterName: characterNames.get(p.characterCode) ?? `#${ p.characterCode }`,
    weaponName: weaponName(p.weaponCode, weaponNames),
  });
  const pickOf = (r: RecentRecord): Pick => ({ characterCode: r.characterCode, weaponCode: r.weaponCode });

  // 실험체별: 최근 경기에서 쓴 전부, 판수 많은 순. 랭크 스쿼드만으로 이뤄졌을 때만 직접 비교로 본다.
  const lookup = pickTierLookup();
  const vision = loadVisionBaseline();
  const kdaOf = loadKdaBaseline();
  const picks: PickComparison[] = [ ...groupBy(records, (r) => pickKey(pickOf(r))).values() ]
    .sort((x, y) => y.length - x.length)
    .map((games) => {
      const pick = pickOf(games[ 0 ]);
      const found = lookup(pick.characterCode, pick.weaponCode);
      const dbMetrics: DbMetrics | null = found && {
        tier: found.tier,
        games: found.stats.games,
        top3Rate: found.stats.top3Rate,
        avgRank: found.stats.avgRank,
        avgDamage: found.stats.avgDamage,
        visionScore: withScore(vision.pick(pick.characterCode, pick.weaponCode), vision)?.score ?? null,
        kda: kdaOf(pick.characterCode, pick.weaponCode),
      };
      return {
        pick: named(pick),
        me: myMetrics(games, vision),
        db: dbMetrics,
        basis: games.every((g) => g.mode === "rankSquad") ? "direct" : "reference",
      };
    });

  // 팀원 조합: 랭크 스쿼드 판 중 팀원을 찾은 판만. DB 등급은 내 실험체별로 한 번씩 계산한다.
  const withMates = records.flatMap((r, i) => {
    const t = teams.get(i);
    return t ? [ { record: r, mates: t.mates } ] : [];
  });
  const tierCache = new Map<string, Map<string, SynergyCombo & { tier: Tier | null }>>();
  const dbCombos = (pick: Pick) => {
    const k = pickKey(pick);
    let byKey = tierCache.get(k);
    if ( !byKey ) {
      const { combos } = getSynergy({ ...pick, allies: [] });
      const tiers = new Map(assignTiers(combos, "overall", COMBO_MIN_GAMES).ranked.map((c) => [ c.key, c.tier ]));
      byKey = new Map(combos.map((c) => [ c.key, { ...c, tier: tiers.get(c.key) ?? null } ]));
      tierCache.set(k, byKey);
    }
    return byKey;
  };

  // 판수가 같으면 DB 등급이 있는 조합을 앞에 둔다 (비교할 거리가 있는 쪽).
  const hasTier = (group: typeof withMates) => ( dbCombos(pickOf(group[ 0 ].record)).get(comboKey(group[ 0 ].mates))?.tier ? 1 : 0 );
  const combos: ComboComparison[] = [ ...groupBy(withMates, (x) => `${ pickKey(pickOf(x.record)) }/${ comboKey(x.mates) }`).values() ]
    .sort((x, y) => y.length - x.length || hasTier(y) - hasTier(x))
    .slice(0, MAX_COMBOS)
    .map((group) => {
      const pick = pickOf(group[ 0 ].record);
      const matePair = group[ 0 ].mates;
      const found = dbCombos(pick).get(comboKey(matePair));
      const me = myMetrics(group.map((x) => x.record), vision);
      return {
        pick: named(pick),
        mates: [ named(matePair[ 0 ]), named(matePair[ 1 ]) ],
        me: { games: me.games, top3Rate: me.top3Rate, avgRank: me.avgRank },
        db: found ? { tier: found.tier, games: found.games, top3Rate: found.top3Rate, avgRank: found.avgRank } : null,
      };
    });

  // 판별 기여: 같은 실험체·무기가 TOP3로 끝난 판의 DB 평균 딜량·KDA와 비교한다.
  const impactBase = loadImpactBaseline();
  const impacts = records.map((r) => gameImpact(r, impactBase(r.characterCode, r.weaponCode)));
  const impact: ImpactSummary = {
    top3: records.filter((r) => r.rank <= 3).length,
    judged: records.filter((r, i) => r.rank <= 3 && impacts[ i ] !== undefined).length,
    carry: impacts.filter((v) => v === "carry").length,
    bus: impacts.filter((v) => v === "bus").length,
  };

  // 시즌 모스트. 딜량·TK는 시즌 통계에 없어 최근 경기에서 같은 실험체(무기 무관)를 쓴 판으로 낸다.
  const most: SeasonMost[] = seasonMost
    .filter((c) => c.totalGames > 0)
    .sort((a, b) => b.totalGames - a.totalGames)
    .map((c) => {
      const played = records.filter((r) => r.characterCode === c.characterCode);
      return {
        characterCode: c.characterCode,
        characterName: characterNames.get(c.characterCode) ?? `#${ c.characterCode }`,
        games: c.totalGames,
        winRate: c.wins / c.totalGames,
        top3Rate: c.top3 / c.totalGames,
        maxKills: c.maxKillings,
        recent: played.length === 0 ? null : {
          games: played.length,
          avgDamage: played.reduce((s, r) => s + r.damage, 0) / played.length,
          avgTeamKill: played.reduce((s, r) => s + r.teamKill, 0) / played.length,
        },
      };
    });

  const recent: RecentGame[] = [ ...records ].map((r, i) => ({
    mode: r.mode,
    rank: r.rank,
    teams: r.teams,
    rp: r.rp,
    damage: r.damage,
    pick: named(pickOf(r)),
    impact: impacts[ i ] ?? null,
  })).reverse();

  const top3 = records.filter((r) => r.rank <= 3);
  const rest = records.filter((r) => r.rank > 3);

  const overall = myMetrics(records, vision);
  const visionRef = withScore(visionReference(records, vision.pick), vision);
  const visionTop3 = withScore(visionAverage(top3), vision);
  const visionTop3Ref = withScore(visionReference(top3, vision.pickTop3), vision);
  const kdaRef = kdaReference(records, kdaOf);

  const latestMmr = records.find((r) => r.mmrBefore !== null)?.mmrBefore ?? null;

  return {
    recent,
    overall,
    picks,
    combos,
    vision: {
      // records는 비어 있지 않으므로 전체 평균은 항상 있다.
      all: withScore(visionAverage(records), vision) ?? { view: 0, cam: 0, camRemove: 0, drone: 0, score: null },
      top3: { games: top3.length, metrics: visionTop3 },
      rest: { games: rest.length, metrics: withScore(visionAverage(rest), vision) },
      ref: visionRef,
      top3Ref: visionTop3Ref,
    },
    kdaRef,
    playstyle: playstyleOf(top3.length, visionTop3, visionTop3Ref, overall.kda.deaths, kdaRef?.deaths ?? null),
    team: teamSummary(records, teams, loadTeamBaseline()),
    impact,
    most,
    belowDbRange: latestMmr === null || latestMmr < DB_MMR_MIN,
  };
}
