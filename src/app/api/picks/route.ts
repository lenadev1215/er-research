import { connection, NextResponse } from "next/server";
import { getPicks } from "@/lib/picks";

// GET /api/picks → 선택 가능한 실험체와 무기 목록
export async function GET() {
  // 요청 객체를 읽지 않아 빌드 때 프리렌더될 수 있으므로, 요청 시점 데이터로 고정한다.
  await connection();
  return NextResponse.json(getPicks());
}
