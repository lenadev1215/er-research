import Image from "next/image";

// 분석 대기 표시. 알렉스 이모티콘(public/emoticon/alex_loading.png, 128px)이 지지직거리며 사라졌다 나타나기를 반복한다.
// 동작 줄이기 설정이면 멈춰 있다 (globals.css).
export function Analyzing() {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-6">
      <Image src="/emoticon/alex_loading.png" alt="" width={96} height={96} unoptimized className="animate-glitch" />
      <p className="text-sm text-muted">분석 중입니다.</p>
    </div>
  );
}
