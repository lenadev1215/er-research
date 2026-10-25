import type { NamedPick } from "@/lib/synergy-aggregate";

export const percent = (v: number) => `${ (v * 100).toFixed(1) }%`;

export const signedRp = (v: number) => `${ v > 0 ? "+" : "" }${ v.toFixed(1) }`;

export const pickLabel = (p: NamedPick) => `${ p.characterName } ${ p.weaponName }`;
