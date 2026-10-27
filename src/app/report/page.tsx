import type { Metadata } from "next";
import { ReportView } from "./report-view";

export const metadata: Metadata = {
  title: "전적 분석 · er-research",
  description: "최근 20판을 수집 데이터와 비교하고 조언을 받습니다",
};

// 셸만 정적으로 그리고, 입력과 결과는 클라이언트에서 다룬다 (닉네임을 URL에 넣지 않는다).
export default function ReportPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-10 sm:px-8 sm:py-14">
      <ReportView />
    </main>
  );
}
