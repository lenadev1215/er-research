// 전적 분석 화면의 UI 상태. 결과는 TanStack Query가 맡고, 여기에는 제출한 닉네임만 둔다.
// 닉네임은 URL·브라우저 저장소에 넣지 않는다. 모듈 스토어라 탭을 오가도 유지되고, 새로고침하면 사라진다.
import { create } from "zustand";

type ReportUiState = {
  nickname: string | null;
  submit: (nickname: string) => void;
};

export const useReportUi = create<ReportUiState>((set) => ({
  nickname: null,
  submit: (nickname) => set({ nickname }),
}));
