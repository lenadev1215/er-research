"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { parseCode } from "@/lib/params";
import type { AllyFilter } from "@/lib/synergy-aggregate";

// 실험체·무기·특성·팀원 선택은 URL이 유일한 기준값이다 (공유·새로고침·뒤로 가기 대응).
// 보기 설정(기준, 최소 판수, 정렬)은 Zustand 스토어가 맡는다.
const DEFAULT_CHARACTER = 1; // 재키
const DEFAULT_WEAPON = 16; // 양손검

export type Selection = {
  characterCode: number;
  weaponCode: number;
  coreTraitCode: number | null;
  allies: [ AllyFilter | null, AllyFilter | null ]; // 팀원 1, 팀원 2 칸
};

type ParamReader = { get: (name: string) => string | null };

function readAlly(searchParams: ParamReader, n: 1 | 2): AllyFilter | null {
  const characterCode = parseCode(searchParams.get(`ally${ n }`));
  if ( characterCode === undefined ) return null;
  return { characterCode, weaponCode: parseCode(searchParams.get(`ally${ n }w`)) ?? null };
}

export function useSelection() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selection: Selection = {
    characterCode: parseCode(searchParams.get("character")) ?? DEFAULT_CHARACTER,
    weaponCode: parseCode(searchParams.get("weapon")) ?? DEFAULT_WEAPON,
    coreTraitCode: parseCode(searchParams.get("trait")) ?? null,
    allies: [ readAlly(searchParams, 1), readAlly(searchParams, 2) ],
  };

  const setSelection = useCallback((next: Selection) => {
    const out = new URLSearchParams({ character: String(next.characterCode), weapon: String(next.weaponCode) });
    if ( next.coreTraitCode !== null ) out.set("trait", String(next.coreTraitCode));
    next.allies.forEach((ally, i) => {
      if ( !ally ) return;
      out.set(`ally${ i + 1 }`, String(ally.characterCode));
      if ( ally.weaponCode !== null ) out.set(`ally${ i + 1 }w`, String(ally.weaponCode));
    });
    // push로 기록을 남겨 뒤로 가기로 이전 선택에 돌아갈 수 있게 한다.
    router.push(`${ pathname }?${ out }`, { scroll: false });
  }, [ pathname, router ]);

  return { selection, setSelection };
}
