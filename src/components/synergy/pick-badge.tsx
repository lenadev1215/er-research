"use client";

import Image from "next/image";
import { Fragment, useState } from "react";
import { CHARACTER_IMAGES_ENABLED, characterImageSrc } from "@/lib/character-image";
import type { NamedPick } from "@/lib/synergy-aggregate";

// 원본이 55px라 2배율 화면에서는 28px까지 선명하다. 그 이상은 약간 흐려지는 것을 감수한다.
const PORTRAIT_PX = 28;

// stack: 초상 아래 이름·무기 (데스크톱 표). inline: 초상 오른쪽에 이름·무기 (모바일 목록, 행 높이를 줄인다).
type Variant = "stack" | "inline";

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

export function PickBadge({ pick, variant = "stack" }: { pick: NamedPick; variant?: Variant }) {
  const text = (
    <>
      <span title={pick.characterName} className="max-w-full truncate text-xs font-medium leading-tight text-ink">{pick.characterName}</span>
      <span title={pick.weaponName} className="max-w-full truncate text-[11px] leading-tight text-muted">{pick.weaponName}</span>
    </>
  );

  if ( variant === "inline" ) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <CharacterImage code={pick.characterCode} name={pick.characterName} px={PORTRAIT_PX} />
        <span className="flex min-w-0 flex-col">{text}</span>
      </span>
    );
  }

  // 폭은 가장 긴 이름(데비&마를렌, 6자)이 한 줄에 들어가게 잡는다. 이름이 줄바꿈되면 표의 행 높이가 들쭉날쭉해진다.
  return (
    <span className="inline-flex w-[72px] flex-col items-center gap-0.5 text-center">
      <CharacterImage code={pick.characterCode} name={pick.characterName} px={PORTRAIT_PX} />
      <span className="mt-0.5 flex w-full flex-col items-center">{text}</span>
    </span>
  );
}

// 남은 자리 1~2명을 "+"로 이어 보여준다.
export function PickGroup({ mates, variant = "stack" }: { mates: NamedPick[]; variant?: Variant }) {
  if ( variant === "inline" ) {
    // 두 번째 팀원이 행마다 같은 위치에서 시작하도록 [팀원 1 | + | 팀원 2] 격자로 둔다.
    return (
      <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {mates.map((m, i) => (
          <Fragment key={`${ m.characterCode }:${ m.weaponCode }`}>
            {i > 0 && <span aria-label="그리고" className="text-muted">+</span>}
            <PickBadge pick={m} variant="inline" />
          </Fragment>
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-1.5">
      {mates.map((m, i) => (
        <span key={`${ m.characterCode }:${ m.weaponCode }`} className="inline-flex items-start gap-1.5">
          {i > 0 && <span aria-label="그리고" className="text-muted" style={{ marginTop: PORTRAIT_PX / 2 - 9 }}>+</span>}
          <PickBadge pick={m} />
        </span>
      ))}
    </span>
  );
}
