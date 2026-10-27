import { NextResponse, type NextRequest } from "next/server";
import { parseCode } from "@/lib/params";
import { getPickTier } from "@/lib/pick-tier";

// GET /api/pick-tier?character=1&weapon=16 → 내 실험체·무기의 티어와 개인 지표
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const characterCode = parseCode(params.get("character"));
  const weaponCode = parseCode(params.get("weapon"));
  if ( characterCode === undefined || weaponCode === undefined ) {
    return NextResponse.json({ error: "character, weapon은 필수 숫자입니다." }, { status: 400 });
  }

  const result = getPickTier(characterCode, weaponCode);
  if ( !result ) return NextResponse.json({ error: "이 실험체·무기로 수집된 경기가 없습니다." }, { status: 404 });
  return NextResponse.json(result);
}
