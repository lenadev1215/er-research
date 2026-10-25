"use client";

import { useQuery } from "@tanstack/react-query";
import type { TraitShare } from "@/lib/traits";
import { useSynergyUi } from "@/stores/synergy-ui";

type Props = { characterCode: number; weaponCode: number };

async function fetchTraits({ characterCode, weaponCode }: Props): Promise<TraitShare[]> {
  const params = new URLSearchParams({ character: String(characterCode), weapon: String(weaponCode) });
  const res = await fetch(`/api/traits?${ params }`);
  if ( !res.ok ) throw new Error(`특성 목록을 불러오지 못했습니다 (${ res.status }).`);
  return res.json();
}

export function TraitSelect(props: Props) {
  const coreTraitCode = useSynergyUi((s) => s.coreTraitCode);
  const setCoreTraitCode = useSynergyUi((s) => s.setCoreTraitCode);
  const { data, isPending, isError } = useQuery({
    queryKey: [ "traits", props.characterCode, props.weaponCode ],
    queryFn: () => fetchTraits(props),
  });

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      특성
      <select
        value={coreTraitCode ?? ""}
        onChange={(e) => setCoreTraitCode(e.target.value === "" ? null : Number(e.target.value))}
        disabled={isPending || isError}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-ink disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf"
      >
        <option value="">전체 특성</option>
        {data?.map((t) => (
          <option key={t.code} value={t.code}>
            {t.name} ({Math.round(t.share * 100)}%)
          </option>
        ))}
      </select>
      {isError && <span role="alert" className="text-alert">목록을 불러오지 못했습니다.</span>}
    </label>
  );
}
