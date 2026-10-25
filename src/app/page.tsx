import { Suspense } from "react";
import { SynergyView } from "./synergy-view";

// 선택(실험체·무기·특성)은 URL 쿼리에서 읽는다. useSearchParams를 쓰므로 Suspense 경계가 필요하다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-10 sm:px-8 sm:py-14">
      <Suspense fallback={<p role="status" className="text-sm text-muted">불러오는 중입니다.</p>}>
        <SynergyView />
      </Suspense>
    </main>
  );
}
