"use client";

import { usePicks } from "@/hooks/use-picks";
import { useSelection } from "@/hooks/use-selection";

export function WeaponSelect() {
  const { selection, setSelection } = useSelection();
  const { data: picks } = usePicks();
  const weapons = picks?.find((p) => p.code === selection.characterCode)?.weapons ?? [];

  if ( weapons.length === 0 ) return null;

  return (
    <div role="radiogroup" aria-label="무기" className="flex flex-wrap items-center gap-2">
      {weapons.map((w) => {
        const active = w.code === selection.weaponCode;
        return (
          <button
            key={w.code}
            type="button"
            role="radio"
            aria-checked={active}
            // 무기를 바꾸면 특성 분포가 달라지므로 특성은 전체로 되돌린다.
            onClick={() => setSelection({ ...selection, weaponCode: w.code, coreTraitCode: null })}
            className={`rounded-md border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf ${
              active ? "border-vf bg-vf text-white" : "border-line bg-surface text-ink hover:border-muted"
            }`}
          >
            {w.name}
            <span className={`ml-1.5 tabular-nums ${ active ? "text-white/80" : "text-muted" }`}>{w.games}판</span>
          </button>
        );
      })}
    </div>
  );
}
