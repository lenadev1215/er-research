"use client";

import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 50;

// 긴 목록을 처음엔 PAGE_SIZE개만 그리고, 끝의 감시 요소가 화면 근처에 오면 PAGE_SIZE개씩 늘린다.
// 데이터는 이미 전부 받아 둔 상태다 (등급이 전체 조합 기준 백분위라 서버에서 나눠 받지 않는다).
// resetDeps 중 하나라도 바뀌면(정렬·기준·선택 변경) 처음 개수로 되돌린다.
export function useIncrementalList(total: number, resetDeps: readonly unknown[]) {
  const [ count, setCount ] = useState(PAGE_SIZE);
  const [ prevDeps, setPrevDeps ] = useState(resetDeps);
  if ( resetDeps.length !== prevDeps.length || resetDeps.some((d, i) => !Object.is(d, prevDeps[ i ])) ) {
    setPrevDeps(resetDeps);
    setCount(PAGE_SIZE);
  }

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = count < total;
  const showMore = () => setCount((c) => c + PAGE_SIZE);

  // count가 바뀔 때마다 다시 관찰한다. 늘린 뒤에도 감시 요소가 여전히 보이면 바로 한 번 더 늘어난다.
  useEffect(() => {
    const el = sentinelRef.current;
    if ( !el || !hasMore ) return;
    const observer = new IntersectionObserver(
      ([ entry ]) => {
        if ( entry.isIntersecting ) setCount((c) => c + PAGE_SIZE);
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ count, hasMore ]);

  return { visibleCount: Math.min(count, total), hasMore, showMore, sentinelRef };
}
