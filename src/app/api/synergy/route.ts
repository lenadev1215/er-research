import { NextResponse, type NextRequest } from "next/server";
import { parseCode } from "@/lib/params";
import { getSynergy } from "@/lib/synergy";
import type { AllyFilter } from "@/lib/synergy-aggregate";

const BAD_REQUEST = "character, weapon은 필수 숫자입니다. trait, ally1, ally1w, ally2, ally2w는 선택 숫자입니다.";

// 선택 파라미터: 없으면 undefined, 있는데 숫자가 아니면 null(잘못된 요청)
const optionalCode = (value: string | null) => (value === null ? undefined : parseCode(value) ?? null);

// GET /api/synergy?character=77&weapon=24[&trait=7300201][&ally1=25&ally1w=3][&ally2=…&ally2w=…]
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const characterCode = parseCode(params.get("character"));
  const weaponCode = parseCode(params.get("weapon"));
  const coreTraitCode = optionalCode(params.get("trait"));

  const allies: AllyFilter[] = [];
  for ( const n of [ 1, 2 ] ) {
    const ally = optionalCode(params.get(`ally${ n }`));
    const allyWeapon = optionalCode(params.get(`ally${ n }w`));
    if ( ally === null || allyWeapon === null ) return NextResponse.json({ error: BAD_REQUEST }, { status: 400 });
    if ( ally !== undefined ) allies.push({ characterCode: ally, weaponCode: allyWeapon ?? null });
  }

  if ( characterCode === undefined || weaponCode === undefined || coreTraitCode === null ) {
    return NextResponse.json({ error: BAD_REQUEST }, { status: 400 });
  }

  return NextResponse.json(getSynergy({ characterCode, weaponCode, coreTraitCode, allies }));
}
