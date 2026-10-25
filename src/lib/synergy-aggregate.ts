// 팀원 조합 집계 (순수 함수). DB·서버 의존이 없어 클라이언트 타입 공유와 테스트에 쓴다.

export type Pick = { characterCode: number; weaponCode: number };

// 내 실험체가 속한 팀 1개 = 1행
export type TeamRow = {
  gameRank: number;
  mmrGain: number; // 내 실험체의 RP 획득량
  teamCount: number;
  mates: [ Pick, Pick ];
};

export type NamedPick = Pick & { characterName: string; weaponName: string };

export type SynergyCombo = {
  key: string;
  mates: [ NamedPick, NamedPick ];
  games: number;
  winRate: number;
  top3Rate: number;
  avgRp: number;
  avgRank: number;
  baselineWinRate: number; // 1 / 팀 수의 평균. 팀 수가 경기마다 달라 고정값을 쓰지 않는다
};

type NameLookup = {
  character: (code: number) => string;
  weapon: (code: number) => string;
};

const comparePick = (x: Pick, y: Pick) =>
  x.characterCode - y.characterCode || x.weaponCode - y.weaponCode;

// A+B와 B+A를 같은 조합으로 묶기 위해 정렬된 키를 만든다.
const comboKey = (mates: [ Pick, Pick ]) =>
  [ ...mates ].sort(comparePick).map((m) => `${ m.characterCode }:${ m.weaponCode }`).join("|");

export function aggregateSynergy(rows: TeamRow[], names: NameLookup): SynergyCombo[] {
  const acc = new Map<string, {
    mates: [ Pick, Pick ];
    games: number;
    wins: number;
    top3: number;
    rpSum: number;
    rankSum: number;
    baselineSum: number;
  }>();

  for ( const row of rows ) {
    const key = comboKey(row.mates);
    const s = acc.get(key) ?? {
      mates: [ ...row.mates ].sort(comparePick) as [ Pick, Pick ],
      games: 0, wins: 0, top3: 0, rpSum: 0, rankSum: 0, baselineSum: 0,
    };
    s.games++;
    if ( row.gameRank === 1 ) s.wins++;
    if ( row.gameRank <= 3 ) s.top3++;
    s.rpSum += row.mmrGain;
    s.rankSum += row.gameRank;
    s.baselineSum += 1 / row.teamCount;
    acc.set(key, s);
  }

  const named = (p: Pick): NamedPick => ({
    ...p,
    characterName: names.character(p.characterCode),
    weaponName: names.weapon(p.weaponCode),
  });

  return [ ...acc ].map(([ key, s ]) => ({
    key,
    mates: [ named(s.mates[ 0 ]), named(s.mates[ 1 ]) ] as [ NamedPick, NamedPick ],
    games: s.games,
    winRate: s.wins / s.games,
    top3Rate: s.top3 / s.games,
    avgRp: s.rpSum / s.games,
    avgRank: s.rankSum / s.games,
    baselineWinRate: s.baselineSum / s.games,
  }));
}
