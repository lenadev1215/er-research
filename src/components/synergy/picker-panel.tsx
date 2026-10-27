"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { usePicks } from "@/hooks/use-picks";
import { CharacterImage } from "./pick-badge";

type Props = {
  id: string;
  selectedCode: number | null;
  onChoose: (code: number) => void;
  onClose: () => void;
  rootRef: RefObject<HTMLElement | null>; // 이 영역 바깥을 누르면 닫힌다
  align?: "left" | "right"; // 오른쪽 칸에서는 오른쪽 끝에 맞춰 화면 밖으로 넘치지 않게 한다
};

// 실험체 검색 + 얼굴 그리드. 내 실험체와 팀원 칸이 함께 쓴다.
export function PickerPanel({ id, selectedCode, onChoose, onClose, rootRef, align = "left" }: Props) {
  const { data: picks, isPending, isError } = usePicks();
  const [ query, setQuery ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = (picks ?? []).filter((p) => p.name.includes(query.trim()));

  // 열리면 검색창에 포커스, 바깥 클릭·Esc로 닫는다.
  useEffect(() => {
    searchRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if ( !rootRef.current?.contains(e.target as Node) ) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if ( e.key === "Escape" ) onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ onClose, rootRef ]);

  return (
    <div
      id={id}
      className={`absolute top-full z-20 mt-2 w-[min(40rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-4 shadow-[0_8px_24px_rgb(28_36_48/0.12)] ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      <label className="sr-only" htmlFor={`${ id }-search`}>실험체 검색</label>
      <input
        id={`${ id }-search`}
        ref={searchRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="실험체 이름으로 검색"
        className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-vf"
      />

      {isError && <p role="alert" className="mt-3 text-sm text-alert">실험체 목록을 불러오지 못했습니다. 새로고침해 다시 시도하세요.</p>}
      {!isError && !isPending && filtered.length === 0 && (
        <p className="mt-3 text-sm text-muted">&lsquo;{query}&rsquo;에 맞는 실험체가 없습니다.</p>
      )}

      <ul className="mt-3 grid max-h-80 grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1 overflow-y-auto">
        {filtered.map((p) => {
          const active = p.code === selectedCode;
          return (
            <li key={p.code}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onChoose(p.code)}
                className={`flex w-full flex-col items-center gap-1 rounded px-1 py-2 text-xs focus-visible:outline-2 focus-visible:outline-vf ${
                  active ? "bg-tier-s/10 font-semibold text-vf" : "text-ink hover:bg-rail"
                }`}
              >
                <CharacterImage code={p.code} name={p.name} px={40} />
                <span className="leading-tight">{p.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
