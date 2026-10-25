"use client";

import { useQuery } from "@tanstack/react-query";
import type { PickOption } from "@/lib/picks";

async function fetchPicks(): Promise<PickOption[]> {
  const res = await fetch("/api/picks");
  if ( !res.ok ) throw new Error(`실험체 목록을 불러오지 못했습니다 (${ res.status }).`);
  return res.json();
}

// 실험체 목록은 자주 바뀌지 않아 길게 캐시한다.
export const usePicks = () =>
  useQuery({ queryKey: [ "picks" ], queryFn: fetchPicks, staleTime: 10 * 60_000 });
