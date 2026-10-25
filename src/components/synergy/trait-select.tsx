"use client";

import { useQuery } from "@tanstack/react-query";
import { useSelection } from "@/hooks/use-selection";
import type { TraitShare } from "@/lib/traits";

async function fetchTraits(characterCode: number, weaponCode: number): Promise<TraitShare[]> {
  const params = new URLSearchParams({ character: String(characterCode), weapon: String(weaponCode) });
  const res = await fetch(`/api/traits?${ params }`);
  if ( !res.ok ) throw new Error(`특성 목록을 불러오지 못했습니다 (${ res.status }).`);
  return res.json();
}

export function TraitSelect() {
  const { selection, setSelection } = useSelection();
  const { characterCode, weaponCode, coreTraitCode } = selection;
  const { data, isPending, isError } = useQuery({
    queryKey: [ "traits", characterCode, weaponCode ],
    queryFn: () => fetchTraits(characterCode, weaponCode),
  });

  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      특성
      <select
        value={coreTraitCode ?? ""}
        onChange={(e) => setSelection({ ...selection, coreTraitCode: e.target.value === "" ? null : Number(e.target.value) })}
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
