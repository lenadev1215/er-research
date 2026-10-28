"use client";

import { experimental_streamedQuery as streamedQuery, useQuery } from "@tanstack/react-query";
import { INITIAL_REPORT, ReportError, reduceReport, streamReport, type ReportState } from "@/lib/report/stream";
import type { ReportErrorCode } from "@/lib/report/types";
import { useReportUi } from "@/stores/report-ui";
import { AdviceBlock } from "@/components/report/advice-block";
import { Analyzing } from "@/components/report/analyzing";
import { ComboCompare } from "@/components/report/combo-compare";
import { NicknameForm } from "@/components/report/nickname-form";
import { PickCompare } from "@/components/report/pick-compare";
import { RecentStrip } from "@/components/report/recent-strip";
import { ReportSummary } from "@/components/report/report-summary";

const ERROR_MESSAGE: Record<ReportErrorCode, string> = {
  "invalid": "닉네임은 1~32자로 입력하세요.",
  "not-found": "이 닉네임의 플레이어를 찾지 못했습니다. 철자와 띄어쓰기를 확인하세요.",
  "no-games": "코발트를 제외한 최근 경기가 없습니다.",
  "rate-limited": "분석 요청이 너무 잦습니다. 몇 분 뒤에 다시 시도하세요.",
  "busy": "지금 다른 분석이 진행 중입니다. 잠시 뒤에 다시 시도하세요.",
  "disabled": "지금은 전적 분석을 쓸 수 없습니다. 데이터를 수집하는 동안에는 꺼 둡니다.",
  "upstream": "전적 서버에서 응답을 받지 못했습니다. 잠시 뒤에 다시 시도하세요.",
  "advice-failed": "소견을 만들지 못했습니다.",
};

export function ReportView() {
  const nickname = useReportUi((s) => s.nickname);
  const submit = useReportUi((s) => s.submit);
  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: [ "report", nickname ],
    queryFn: streamedQuery({
      streamFn: ({ signal }) => streamReport(nickname ?? "", signal),
      reducer: reduceReport,
      initialValue: INITIAL_REPORT,
    }),
    enabled: nickname !== null,
    // 한 번 분석할 때마다 외부 API와 Claude를 부른다. 자동 재요청·재시도를 하지 않는다.
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 같은 닉네임도 다시 요청한다. 5분 안이면 서버 캐시가 바로 돌려주고, 캐시 응답은 IP 제한에 세지 않는다.
  const handleSubmit = (next: string) => {
    if ( next !== nickname ) return submit(next);
    void refetch();
  };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-ink">전적 분석</h1>
        <NicknameForm initial={nickname ?? ""} busy={isFetching} onSubmit={handleSubmit} />
      </header>

      {nickname !== null && (
        <Result
          isPending={isPending}
          errorCode={isError ? ( error instanceof ReportError ? error.code : "upstream" ) : null}
          data={data}
          streaming={isFetching}
        />
      )}
    </div>
  );
}

type ResultProps = {
  isPending: boolean;
  errorCode: ReportErrorCode | null;
  data: ReportState | undefined;
  streaming: boolean;
};

function Result({ isPending, errorCode, data, streaming }: ResultProps) {
  if ( errorCode === "no-games" ) {
    return <p className="rounded-md bg-surface px-5 py-8 text-sm text-muted">{ERROR_MESSAGE[ errorCode ]} 일반·랭크 경기를 한 판 이상 치른 뒤 다시 분석하세요.</p>;
  }
  if ( errorCode ) return <p role="alert" className="text-sm text-alert">{ERROR_MESSAGE[ errorCode ]}</p>;
  if ( isPending || !data?.stats ) return <Analyzing />;

  const { stats } = data;
  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="recent-heading" className="flex flex-col gap-5">
        <h2 id="recent-heading" className="text-sm font-semibold text-ink">최근 {stats.recent.length}판</h2>
        <RecentStrip games={stats.recent} />
        <ReportSummary overall={stats.overall} vision={stats.vision} team={stats.team} impact={stats.impact} most={stats.most} playstyle={stats.playstyle} recent={stats.recent} />
        {stats.belowDbRange && (
          <p className="text-xs text-muted">수집 데이터는 다이아몬드 이상 랭크 경기 기준입니다. 비교 수치는 참고로 보세요.</p>
        )}
      </section>

      <AdviceBlock advice={data.advice} streaming={streaming && !data.done} failed={data.adviceFailed} />

      <PickCompare picks={stats.picks} />
      <ComboCompare combos={stats.combos} />
    </div>
  );
}
