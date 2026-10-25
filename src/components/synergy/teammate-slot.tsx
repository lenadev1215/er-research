"use client";

import { useCallback, useId, useRef, useState } from "react";
import { usePicks } from "@/hooks/use-picks";
import { useSelection } from "@/hooks/use-selection";
import type { AllyFilter } from "@/lib/synergy-aggregate";
import { CharacterImage } from "./pick-badge";
import { PickerPanel } from "./picker-panel";

// 팀원 칸 (index 0 = 팀원 1, 1 = 팀원 2). 비어 있으면 그 자리는 조건 없음.
export function TeammateSlot({ index }: { index: 0 | 1 }) {
  const { selection, setSelection } = useSelection();
  const { data: picks } = usePicks();
  const [ open, setOpen ] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  const ally = selection.allies[ index ];
  const pick = ally ? picks?.find((p) => p.code === ally.characterCode) : undefined;
  const label = `팀원 ${ index + 1 }`;

  const setAlly = (next: AllyFilter | null) => {
    const allies: [ AllyFilter | null, AllyFilter | null ] = [ ...selection.allies ];
    allies[ index ] = next;
    setSelection({ ...selection, allies });
  };

  const choose = (code: number) => {
    // 무기는 무관으로 시작한다 (표본 확보).
    setAlly({ characterCode: code, weaponCode: null });
    setOpen(false);
  };

  const weaponOptions: { code: number | null; name: string }[] = [
    { code: null, name: "무기 무관" },
    ...(pick?.weapons ?? []),
  ];

  return (
    <section aria-label={label} className="flex flex-col gap-3 rounded-md bg-surface p-4">
      <div ref={rootRef} className="relative flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-3 rounded-md py-1 pr-2 text-left hover:bg-rail/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf"
        >
          {ally ? (
            <>
              <CharacterImage code={ally.characterCode} name={pick?.name ?? "?"} px={40} />
              <span className="flex flex-col">
                <span className="text-xs text-muted">{label}</span>
                <span className="truncate text-lg font-semibold text-ink">{pick?.name ?? `#${ ally.characterCode }`}</span>
              </span>
              <span aria-hidden className="text-muted">▾</span>
            </>
          ) : (
            <>
              <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-muted text-xl text-muted">+</span>
              <span className="flex flex-col">
                <span className="text-xs text-muted">{label}</span>
                <span className="text-base text-muted">팀원 선택</span>
              </span>
            </>
          )}
        </button>

        {ally && (
          <button
            type="button"
            onClick={() => setAlly(null)}
            aria-label={`${ label } 비우기`}
            className="rounded px-2 py-1 text-lg leading-none text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-vf"
          >
            ×
          </button>
        )}

        {open && (
          <PickerPanel
            id={panelId}
            selectedCode={ally?.characterCode ?? null}
            onChoose={choose}
            onClose={close}
            rootRef={rootRef}
            align={index === 1 ? "right" : "left"}
          />
        )}
      </div>

      {ally && pick && (
        <div role="radiogroup" aria-label={`${ label } 무기`} className="flex flex-wrap gap-1.5">
          {weaponOptions.map((w) => {
            const active = w.code === ally.weaponCode;
            return (
              <button
                key={w.code ?? "any"}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAlly({ ...ally, weaponCode: w.code })}
                className={`rounded-md border px-2.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf ${
                  active ? "border-vf bg-vf text-white" : "border-line bg-paper text-ink hover:border-muted"
                }`}
              >
                {w.name}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
