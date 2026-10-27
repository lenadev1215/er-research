"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSelection } from "@/hooks/use-selection";
import type { PickTierResponse } from "@/lib/pick-tier";
import { damage, percent, signedRp } from "./format";
import { TierBadge } from "./tier-badge";

async function fetchPickTier(characterCode: number, weaponCode: number): Promise<PickTierResponse> {
  const res = await fetch(`/api/pick-tier?character=${ characterCode }&weapon=${ weaponCode }`);
  if ( res.status === 404 ) throw new Error("이 실험체·무기로 수집된 경기가 아직 없습니다.");
  if ( !res.ok ) throw new Error(`실험체 티어를 불러오지 못했습니다 (${ res.status }).`);
  return res.json();
}

const orDash = (v: number | null, format: (n: number) => string) => (v === null ? "-" : format(v));

// 내 실험체·무기의 티어와 개인 지표. 팀원 조합과 관계없이 전체 실험체·무기와 비교한 값이다.
export function PickTierSummary() {
  const { selection } = useSelection();
  const { characterCode, weaponCode } = selection;
  const { data, isPending, isError, error, isPlaceholderData } = useQuery({
    queryKey: [ "pick-tier", characterCode, weaponCode ],
    queryFn: () => fetchPickTier(characterCode, weaponCode),
    placeholderData: keepPreviousData,
  });

  if ( isPending ) return <p role="status" className="text-sm text-muted">실험체 티어를 불러오는 중입니다.</p>;
  if ( isError || !data ) return <p className="text-sm text-muted">{error?.message}</p>;

  const { stats } = data;
  const metrics = [
    { label: "1위율", value: percent(stats.winRate), tone: "text-ink" },
    { label: "TOP3", value: percent(stats.top3Rate), tone: "text-ink" },
    { label: "평균 RP", value: signedRp(stats.avgRp), tone: stats.avgRp < 0 ? "text-alert" : "text-vf" },
    { label: "평균 순위", value: stats.avgRank.toFixed(1), tone: "text-ink" },
    { label: "평균 TK", value: orDash(stats.avgTk, (n) => n.toFixed(1)), tone: "text-ink" },
    { label: "평균 딜량", value: orDash(stats.avgDamage, damage), tone: "text-ink" },
  ];

  return (
    <section
      aria-label="실험체 티어"
      aria-busy={isPlaceholderData}
      className={`flex items-stretch gap-3 transition-opacity ${ isPlaceholderData ? "opacity-60" : "" }`}
    >
      {data.tier && <TierBadge tier={data.tier} tall />}
      <div className="flex flex-col gap-1.5">
        <dl className="grid grid-cols-3 gap-x-5 gap-y-1.5 md:grid-cols-6">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col">
              <dt className="text-[11px] text-muted">{m.label}</dt>
              <dd className={`text-[15px] font-medium tabular-nums ${ m.tone }`}>{m.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted">
          {stats.games.toLocaleString("ko-KR")}판
          {data.tier && data.rank !== null
            ? ` · 실험체·무기 ${ data.rankedCount }개 중 ${ data.rank }위`
            : ` · ${ data.minGames }판 미만이라 등급을 매기지 않았습니다`}
        </p>
      </div>
    </section>
  );
}
