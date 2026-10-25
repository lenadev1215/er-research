"use client";

import { useCallback, useId, useRef, useState } from "react";
import { usePicks } from "@/hooks/use-picks";
import { useSelection } from "@/hooks/use-selection";
import { CharacterImage } from "./pick-badge";
import { PickerPanel } from "./picker-panel";

// 내 실험체 선택
export function CharacterPicker() {
  const { selection, setSelection } = useSelection();
  const { data: picks, isPending } = usePicks();
  const [ open, setOpen ] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);

  const current = picks?.find((p) => p.code === selection.characterCode);

  const choose = (code: number) => {
    const pick = picks?.find((p) => p.code === code);
    if ( !pick ) return;
    // 실험체를 바꾸면 가장 많이 쓰인 무기로, 특성은 전체로 되돌린다. 팀원 선택은 유지한다.
    setSelection({ ...selection, characterCode: code, weaponCode: pick.weapons[ 0 ].code, coreTraitCode: null });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-md py-1 pr-2 text-left hover:bg-rail/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf"
      >
        <CharacterImage code={selection.characterCode} name={current?.name ?? "?"} px={56} />
        <span className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {current?.name ?? (isPending ? "불러오는 중" : `#${ selection.characterCode }`)}
        </span>
        <span aria-hidden className="text-lg text-muted">▾</span>
        <span className="sr-only">내 실험체 바꾸기</span>
      </button>

      {open && (
        <PickerPanel id={panelId} selectedCode={selection.characterCode} onChoose={choose} onClose={close} rootRef={rootRef} />
      )}
    </div>
  );
}
