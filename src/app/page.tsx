import { SynergyView } from "./synergy-view";

// 확인용 화면: 유민 / 아르카나 고정, 특성은 드롭다운으로 선택. 실험체 선택 UI는 다음 단계에서 붙인다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-10 sm:px-8 sm:py-14">
      <SynergyView characterCode={77} weaponCode={24} />
    </main>
  );
}
