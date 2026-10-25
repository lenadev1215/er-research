import { NextResponse, type NextRequest } from "next/server";
import { parseCode } from "@/lib/params";
import { getCoreTraitShares } from "@/lib/traits";

// GET /api/traits?character=77&weapon=24 → 사용 비율 10% 이상인 핵심 특성
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const characterCode = parseCode(params.get("character"));
  const weaponCode = parseCode(params.get("weapon"));

  if ( characterCode === undefined || weaponCode === undefined ) {
    return NextResponse.json({ error: "character, weapon은 필수 숫자입니다." }, { status: 400 });
  }

  return NextResponse.json(getCoreTraitShares(characterCode, weaponCode));
}
