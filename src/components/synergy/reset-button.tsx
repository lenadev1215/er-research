"use client";

import { useSelection } from "@/hooks/use-selection";
import { isDefaultView, useSynergyUi } from "@/stores/synergy-ui";

// 선택(실험체·무기·특성·팀원)과 보기 설정(기준·최소 판수·정렬)을 모두 처음 상태로 되돌린다.
export function ResetButton({ className = "" }: { className?: string }) {
  const { resetSelection, isDefault } = useSelection();
  const viewIsDefault = useSynergyUi(isDefaultView);
  const resetView = useSynergyUi((s) => s.resetView);
  const disabled = isDefault && viewIsDefault;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        resetView();
        resetSelection();
      }}
      className={`shrink-0 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:bg-rail/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface ${ className }`}
    >
      초기화
    </button>
  );
}
