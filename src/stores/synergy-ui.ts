// 조합 화면의 UI 상태. 서버 데이터는 TanStack Query가 맡고, 여기에는 넣지 않는다.
// 서버에서 값을 쓰지 않는 순수 클라이언트 상태라 모듈 단위 스토어로 둔다.
import { create } from "zustand";
import type { Criterion } from "@/lib/tier";

export type SortKey = "score" | "games" | "winRate" | "top3Rate" | "avgRp" | "avgRank";
export type SortDir = "asc" | "desc";

// 평균 순위만 낮을수록 좋다.
const defaultDir = (key: SortKey): SortDir => (key === "avgRank" ? "asc" : "desc");

// 실험체·무기·특성 선택은 URL이 맡는다 (hooks/use-selection.ts).
type SynergyUiState = {
  criterion: Criterion;
  minGames: number;
  sort: { key: SortKey; dir: SortDir };
  setCriterion: (criterion: Criterion) => void;
  setMinGames: (minGames: number) => void;
  toggleSort: (key: SortKey) => void;
  setSortKey: (key: SortKey) => void; // 모바일 정렬 선택 상자용. 방향은 지표별 기본값
};

export const useSynergyUi = create<SynergyUiState>()((set) => ({
  criterion: "overall",
  minGames: 1, // 표본 확보 전 임시값. 기획 기본값은 30판
  sort: { key: "score", dir: "desc" },
  // 기준을 바꾸면 그 기준 점수 순으로 다시 보여준다.
  setCriterion: (criterion) => set({ criterion, sort: { key: "score", dir: "desc" } }),
  setMinGames: (minGames) => set({ minGames }),
  setSortKey: (key) => set({ sort: { key, dir: defaultDir(key) } }),
  toggleSort: (key) => set(({ sort }) => ({
    sort: sort.key === key
      ? { key, dir: sort.dir === "asc" ? "desc" : "asc" }
      : { key, dir: defaultDir(key) },
  })),
}));
