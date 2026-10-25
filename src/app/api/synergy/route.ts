import { NextResponse, type NextRequest } from "next/server";
import { parseCode } from "@/lib/params";
import { getSynergy } from "@/lib/synergy";

// GET /api/synergy?character=11&weapon=18&trait=7100401 (trait는 선택)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const characterCode = parseCode(params.get("character"));
  const weaponCode = parseCode(params.get("weapon"));
  const traitParam = params.get("trait");
  const coreTraitCode = parseCode(traitParam);

  if ( characterCode === undefined || weaponCode === undefined || ( traitParam !== null && coreTraitCode === undefined ) ) {
    return NextResponse.json(
      { error: "character, weapon은 필수 숫자이며 trait는 선택 숫자입니다." },
      { status: 400 },
    );
  }

  return NextResponse.json(getSynergy({ characterCode, weaponCode, coreTraitCode }));
}
