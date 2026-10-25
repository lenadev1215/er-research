"use client";

import Image from "next/image";
import { useState } from "react";
import { CHARACTER_IMAGES_ENABLED, characterImageSrc } from "@/lib/character-image";
import type { NamedPick } from "@/lib/synergy-aggregate";

// 원본이 55px라 2배율 화면에서는 28px까지 선명하다. 그 이상은 약간 흐려지는 것을 감수한다.
const SIZES = {
  sm: { px: 28, width: "w-12", name: "text-xs", weapon: "text-[11px]" },
  md: { px: 40, width: "w-14", name: "text-[13px]", weapon: "text-xs" },
} as const;

type Size = keyof typeof SIZES;

export function CharacterImage({ code, name, px }: { code: number; name: string; px: number }) {
  const [ failed, setFailed ] = useState(false);
  const box = { width: px, height: px };

  // 이미지가 없는 신규 실험체 등은 이름 첫 글자로 대체한다.
  if ( !CHARACTER_IMAGES_ENABLED || failed ) {
    return (
      <span aria-hidden style={box} className="flex shrink-0 items-center justify-center rounded bg-rail text-sm font-semibold text-muted">
        {name.slice(0, 1)}
      </span>
    );
  }

  // 이름이 바로 옆·아래 텍스트로 있어 스크린리더 중복 낭독을 피하려고 장식용 alt=""로 둔다.
  return (
    <Image
      src={characterImageSrc(code)}
      alt=""
      width={px}
      height={px}
      unoptimized
      onError={() => setFailed(true)}
      className="shrink-0 rounded bg-rail"
    />
  );
}

export function PickBadge({ pick, size = "md" }: { pick: NamedPick; size?: Size }) {
  const s = SIZES[ size ];
  return (
    <span className={`inline-flex flex-col items-center text-center ${ s.width }`}>
      <CharacterImage code={pick.characterCode} name={pick.characterName} px={s.px} />
      <span className={`mt-1 font-medium leading-tight text-ink ${ s.name }`}>{pick.characterName}</span>
      <span className={`leading-tight text-muted ${ s.weapon }`}>{pick.weaponName}</span>
    </span>
  );
}

export function PickPair({ mates, size = "md" }: { mates: [ NamedPick, NamedPick ]; size?: Size }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      <PickBadge pick={mates[ 0 ]} size={size} />
      <span aria-label="그리고" className="text-muted" style={{ marginTop: SIZES[ size ].px / 2 - 9 }}>+</span>
      <PickBadge pick={mates[ 1 ]} size={size} />
    </span>
  );
}
