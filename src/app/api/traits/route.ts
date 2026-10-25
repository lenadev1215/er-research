import { NextResponse, type NextRequest } from "next/server";
import { parseCode } from "@/lib/params";
import { getCoreTraitShares } from "@/lib/traits";

// GET /api/traits?character=77&weapon=24 → 해당 실험체/무기로 쓰인 모든 핵심 특성 (비율 높은 순)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const characterCode = parseCode(params.get("character"));
  const weaponCode = parseCode(params.get("weapon"));

  if ( characterCode === undefined || weaponCode === undefined ) {
    return NextResponse.json({ error: "character, weapon은 필수 숫자입니다." }, { status: 400 });
  }

  return NextResponse.json(getCoreTraitShares(characterCode, weaponCode));
}
