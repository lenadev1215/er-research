// 팀원 조합 집계 (순수 함수). DB·서버 의존이 없어 클라이언트 타입 공유와 테스트에 쓴다.

export type Pick = { characterCode: number; weaponCode: number };

// 팀원 지정 조건. weaponCode가 null이면 무기 무관.
export type AllyFilter = { characterCode: number; weaponCode: number | null };

// 내 실험체가 속한 팀 1개 = 1행
export type TeamRow = {
  gameRank: number;
  mmrGain: number; // 내 실험체의 RP 획득량
  teamKill: number | null; // 팀 킬 수. 수집 시점에 따라 아직 없을 수 있다
  teamCount: number;
  mates: [ Pick, Pick ];
};

export type NamedPick = Pick & { characterName: string; weaponName: string };

export type Stats = {
  games: number;
  winRate: number;
  top3Rate: number;
  avgRp: number;
  avgRank: number;
  avgTk: number | null; // TK가 있는 경기만으로 낸 평균. 하나도 없으면 null
  baselineWinRate: number; // 1 / 팀 수의 평균. 팀 수가 경기마다 달라 고정값을 쓰지 않는다
};

// mates: 지정한 팀원을 뺀 "남은 자리". 팀원 0명 지정 시 2명, 1명 지정 시 1명, 2명 지정 시 0명.
export type SynergyCombo = Stats & { key: string; mates: NamedPick[] };

type NameLookup = {
  character: (code: number) => string;
  weapon: (code: number) => string;
};

const comparePick = (x: Pick, y: Pick) =>
  x.characterCode - y.characterCode || x.weaponCode - y.weaponCode;

// A+B와 B+A를 같은 조합으로 묶기 위해 정렬된 키를 만든다.
const comboKey = (mates: Pick[]) =>
  mates.length === 0 ? "team" : [ ...mates ].sort(comparePick).map((m) => `${ m.characterCode }:${ m.weaponCode }`).join("|");

const matches = (ally: AllyFilter, pick: Pick) =>
  ally.characterCode === pick.characterCode && ( ally.weaponCode === null || ally.weaponCode === pick.weaponCode );

// 지정한 팀원을 서로 다른 자리에 대응시키고 남은 자리를 돌려준다. 대응이 안 되면 null.
export function remainingMates(mates: [ Pick, Pick ], allies: AllyFilter[]): Pick[] | null {
  if ( allies.length === 0 ) return mates;
  if ( allies.length === 1 ) {
    if ( matches(allies[ 0 ], mates[ 0 ]) ) return [ mates[ 1 ] ];
    if ( matches(allies[ 0 ], mates[ 1 ]) ) return [ mates[ 0 ] ];
    return null;
  }
  const [ a, b ] = allies;
  const fits = ( matches(a, mates[ 0 ]) && matches(b, mates[ 1 ]) ) || ( matches(a, mates[ 1 ]) && matches(b, mates[ 0 ]) );
  return fits ? [] : null;
}

type Acc = { games: number; wins: number; top3: number; rpSum: number; rankSum: number; tkGames: number; tkSum: number; baselineSum: number };

const emptyAcc = (): Acc => ({ games: 0, wins: 0, top3: 0, rpSum: 0, rankSum: 0, tkGames: 0, tkSum: 0, baselineSum: 0 });

function add(acc: Acc, row: TeamRow) {
  acc.games++;
  if ( row.gameRank === 1 ) acc.wins++;
  if ( row.gameRank <= 3 ) acc.top3++;
  acc.rpSum += row.mmrGain;
  acc.rankSum += row.gameRank;
  if ( row.teamKill !== null ) {
    acc.tkGames++;
    acc.tkSum += row.teamKill;
  }
  acc.baselineSum += 1 / row.teamCount;
}

const toStats = (s: Acc): Stats => ({
  games: s.games,
  winRate: s.games ? s.wins / s.games : 0,
  top3Rate: s.games ? s.top3 / s.games : 0,
  avgRp: s.games ? s.rpSum / s.games : 0,
  avgRank: s.games ? s.rankSum / s.games : 0,
  avgTk: s.tkGames ? s.tkSum / s.tkGames : null,
  baselineWinRate: s.games ? s.baselineSum / s.games : 0,
});

// 팀원 지정 없이 내 실험체의 전체 성적. 요약 카드의 비교 기준.
export function summarize(rows: TeamRow[]): Stats {
  const acc = emptyAcc();
  for ( const row of rows ) add(acc, row);
  return toStats(acc);
}

export function aggregateSynergy(rows: TeamRow[], names: NameLookup, allies: AllyFilter[] = []): SynergyCombo[] {
  const groups = new Map<string, Acc & { mates: Pick[] }>();

  for ( const row of rows ) {
    const rest = remainingMates(row.mates, allies);
    if ( rest === null ) continue;
    const key = comboKey(rest);
    const g = groups.get(key) ?? { ...emptyAcc(), mates: [ ...rest ].sort(comparePick) };
    add(g, row);
    groups.set(key, g);
  }

  const named = (p: Pick): NamedPick => ({
    ...p,
    characterName: names.character(p.characterCode),
    weaponName: names.weapon(p.weaponCode),
  });

  return [ ...groups ].map(([ key, g ]) => ({ key, mates: g.mates.map(named), ...toStats(g) }));
}
