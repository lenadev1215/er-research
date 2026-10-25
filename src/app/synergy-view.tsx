"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SynergyResponse } from "@/lib/synergy";
import { assignTiers } from "@/lib/tier";
import { useSynergyUi } from "@/stores/synergy-ui";
import { ComboTable } from "@/components/synergy/combo-table";
import { CriterionControls } from "@/components/synergy/criterion-controls";
import { pickLabel } from "@/components/synergy/format";
import { CharacterImage } from "@/components/synergy/pick-badge";
import { TierBoard } from "@/components/synergy/tier-board";
import { TraitSelect } from "@/components/synergy/trait-select";

type Props = { characterCode: number; weaponCode: number };

async function fetchSynergy(characterCode: number, weaponCode: number, coreTraitCode: number | null): Promise<SynergyResponse> {
  const params = new URLSearchParams({ character: String(characterCode), weapon: String(weaponCode) });
  if ( coreTraitCode !== null ) params.set("trait", String(coreTraitCode));

  const res = await fetch(`/api/synergy?${ params }`);
  if ( !res.ok ) throw new Error(`조합을 불러오지 못했습니다 (${ res.status }). 새로고침해 다시 시도하세요.`);
  return res.json();
}

export function SynergyView({ characterCode, weaponCode }: Props) {
  const coreTraitCode = useSynergyUi((s) => s.coreTraitCode);
  const criterion = useSynergyUi((s) => s.criterion);
  const minGames = useSynergyUi((s) => s.minGames);
  const { data, isPending, isError, error, isPlaceholderData } = useQuery({
    queryKey: [ "synergy", characterCode, weaponCode, coreTraitCode ],
    queryFn: () => fetchSynergy(characterCode, weaponCode, coreTraitCode),
    // 특성을 바꾸는 동안 화면을 비우지 않고 이전 결과를 유지한다
    placeholderData: keepPreviousData,
  });

  if ( isPending ) return <p role="status" className="text-sm text-muted">조합을 불러오는 중입니다.</p>;
  if ( isError ) return <p role="alert" className="text-sm text-alert">{error.message}</p>;

  const { me, totalGames, combos } = data;
  const result = assignTiers(combos, criterion, minGames);

  return (
    <div aria-busy={isPlaceholderData} className={`flex flex-col gap-8 transition-opacity ${ isPlaceholderData ? "opacity-60" : "" }`}>
      <header className="flex items-start gap-4">
        <CharacterImage code={characterCode} name={me.characterName} px={56} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {[ me.characterName, me.weaponName, me.coreTraitName ].filter(Boolean).join(" / ")}
          </h1>
          <p className="text-[15px] text-muted">
            랭크 스쿼드 {totalGames}판에서 같은 팀이었던 팀원 조합 {combos.length}개를 가져왔슴덩 ㅇㅅㅇ
          </p>
          <div className="mt-2">
            <TraitSelect characterCode={characterCode} weaponCode={weaponCode} />
          </div>
        </div>
      </header>

      {combos.length === 0 ? (
        <p className="rounded-md bg-surface px-5 py-8 text-sm text-muted">
          이 실험체로 수집된 경기가 아직 없습니다. 수집이 진행되면 판정이 채워집니다.
        </p>
      ) : (
        <>
          <CriterionControls />
          <TierBoard result={result} criterion={criterion} />

          <section aria-labelledby="detail-heading" className="flex flex-col gap-3">
            <h2 id="detail-heading" className="text-lg font-semibold text-ink">상세 지표</h2>
            {result.ranked.length > 0 && <ComboTable combos={result.ranked} />}
          </section>

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
        </>
      )}
    </div>
  );
}
