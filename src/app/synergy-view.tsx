"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSelection, type Selection } from "@/hooks/use-selection";
import type { SynergyResponse } from "@/lib/synergy";
import { assignTiers, type Criterion } from "@/lib/tier";
import { useSynergyUi } from "@/stores/synergy-ui";
import { CharacterPicker } from "@/components/synergy/character-picker";
import { ComboTable } from "@/components/synergy/combo-table";
import { CriterionControls } from "@/components/synergy/criterion-controls";
import { pickLabel } from "@/components/synergy/format";
import { PickTierSummary } from "@/components/synergy/pick-tier-summary";
import { ResetButton } from "@/components/synergy/reset-button";
import { SynergySummary } from "@/components/synergy/synergy-summary";
import { TeammateSlot } from "@/components/synergy/teammate-slot";
import { TraitSelect } from "@/components/synergy/trait-select";
import { WeaponSelect } from "@/components/synergy/weapon-select";

async function fetchSynergy({ characterCode, weaponCode, coreTraitCode, allies }: Selection): Promise<SynergyResponse> {
  const params = new URLSearchParams({ character: String(characterCode), weapon: String(weaponCode) });
  if ( coreTraitCode !== null ) params.set("trait", String(coreTraitCode));
  // 빈 칸은 건너뛰고, 채워진 팀원만 순서대로 ally1, ally2로 보낸다.
  allies.filter((a) => a !== null).forEach((ally, i) => {
    params.set(`ally${ i + 1 }`, String(ally.characterCode));
    if ( ally.weaponCode !== null ) params.set(`ally${ i + 1 }w`, String(ally.weaponCode));
  });

  const res = await fetch(`/api/synergy?${ params }`);
  if ( !res.ok ) throw new Error(`조합을 불러오지 못했습니다 (${ res.status }). 새로고침해 다시 시도하세요.`);
  return res.json();
}

export function SynergyView() {
  const { selection } = useSelection();
  const { characterCode, weaponCode, coreTraitCode, allies } = selection;
  const allyCount = allies.filter(Boolean).length;
  const criterion = useSynergyUi((s) => s.criterion);
  const minGames = useSynergyUi((s) => s.minGames);
  const { data, isPending, isError, error, isPlaceholderData } = useQuery({
    queryKey: [ "synergy", characterCode, weaponCode, coreTraitCode, allies ],
    queryFn: () => fetchSynergy(selection),
    // 선택을 바꾸는 동안 화면을 비우지 않고 이전 결과를 유지한다
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="sr-only">
          {data ? [ data.me.characterName, data.me.weaponName, data.me.coreTraitName ].filter(Boolean).join(" / ") : "팀원 조합"}
        </h1>
        {/* 넓은 화면: 이름 | 실험체 티어 | 초기화(오른쪽 끝). 좁은 화면: 이름과 초기화가 한 줄, 실험체 티어는 아래 줄. */}
        <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-8">
          <CharacterPicker />
          <ResetButton className="ml-auto lg:order-last" />
          <div className="w-full lg:w-auto">
            <PickTierSummary />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <WeaponSelect />
          <TraitSelect />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TeammateSlot index={0} />
          <TeammateSlot index={1} />
        </div>
        {data && allyCount < 2 && (
          <p className="text-[15px] text-muted">
            랭크 스쿼드 {data.totalGames}판에서 같은 팀이었던 팀원 조합 {data.combos.length}개를 가져왔슴덩 ㅇㅅㅇ
          </p>
        )}
      </header>

      <Results
        data={data}
        isPending={isPending}
        isError={isError}
        errorMessage={error?.message}
        isStale={isPlaceholderData}
        allyCount={allyCount}
        criterion={criterion}
        minGames={minGames}
      />
    </div>
  );
}

type ResultsProps = {
  data: SynergyResponse | undefined;
  isPending: boolean;
  isError: boolean;
  errorMessage: string | undefined;
  isStale: boolean;
  allyCount: number;
  criterion: Criterion;
  minGames: number;
};

function Results({ data, isPending, isError, errorMessage, isStale, allyCount, criterion, minGames }: ResultsProps) {
  // 참조를 고정해 두면 표가 이 값이 바뀔 때만 표시 개수를 처음으로 되돌린다.
  const result = useMemo(() => (data ? assignTiers(data.combos, criterion, minGames) : null), [ data, criterion, minGames ]);

  if ( isPending ) return <p role="status" className="text-sm text-muted">조합을 불러오는 중입니다.</p>;
  if ( isError || !data || !result ) return <p role="alert" className="text-sm text-alert">{errorMessage}</p>;

  if ( data.combos.length === 0 ) {
    return (
      <p className="rounded-md bg-surface px-5 py-8 text-sm text-muted">
        {allyCount > 0
          ? "이 팀원과 같은 팀이었던 경기가 아직 없습니다. 팀원 무기를 '무기 무관'으로 두거나 다른 팀원을 선택해 보세요."
          : "이 조건으로 수집된 경기가 아직 없습니다. 다른 무기나 특성을 선택해 보세요."}
      </p>
    );
  }

  // 팀원 2명을 모두 고르면 남은 자리가 없으므로 조합 하나의 요약을 보여준다.
  if ( allyCount === 2 ) {
    return (
      <div aria-busy={isStale} className={`transition-opacity ${ isStale ? "opacity-60" : "" }`}>
        <SynergySummary team={data.combos[ 0 ]} baseline={data.baseline} />
      </div>
    );
  }

  const groupLabel = allyCount === 1 ? "마지막 한 자리" : "팀원 조합";

  return (
    <div aria-busy={isStale} className={`flex flex-col gap-6 transition-opacity ${ isStale ? "opacity-60" : "" }`}>
      <CriterionControls />

      {result.ranked.length > 0 ? (
        <ComboTable combos={result.ranked} groupLabel={groupLabel} showTier={criterion === "overall"} />
      ) : (
        <p className="rounded-md bg-surface px-5 py-8 text-sm text-muted">
          최소 판수를 넘는 조합이 없습니다. 최소 판수를 낮추면 판정할 수 있습니다.
        </p>
      )}

      {result.insufficient.length > 0 && (
        <details className="rounded-md bg-surface px-5 py-3 text-sm">
          <summary className="cursor-pointer text-muted focus-visible:outline-2 focus-visible:outline-vf">
            표본이 부족한 조합 {result.insufficient.length}개 ({minGames}판 미만)
          </summary>
          <ul className="mt-3 flex flex-col gap-1.5 text-ink">
            {result.insufficient.map((c) => (
              <li key={c.key}>
                {c.mates.map(pickLabel).join(" + ")}
                <span className="ml-2 tabular-nums text-muted">{c.games}판</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
