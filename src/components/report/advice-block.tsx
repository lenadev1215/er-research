import { Analyzing } from "./analyzing";

type Props = {
  advice: string;
  streaming: boolean;
  failed: boolean;
};

// 알렉스의 소견. 조각이 도착하는 대로 이어 붙이고, 스크린리더에는 aria-live로 차분히 알린다.
export function AdviceBlock({ advice, streaming, failed }: Props) {
  const paragraphs = advice.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <section aria-labelledby="advice-heading" className="flex flex-col gap-3 border-l-2 border-vf pl-5">
      <h2 id="advice-heading" className="text-sm font-semibold text-ink">알렉스의 전략 분석</h2>
      <div aria-live="polite" aria-busy={streaming} className="flex flex-col gap-3 text-[15px] leading-7 text-ink">
        {paragraphs.length === 0 && streaming && <Analyzing />}
        {paragraphs.map((p, i) => (
          <p key={i}>
            {p}
            {streaming && i === paragraphs.length - 1 && (
              <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-vf motion-safe:animate-pulse" />
            )}
          </p>
        ))}
        {failed && (
          <p role="alert" className="text-sm text-alert">
            전략 분석을 만들지 못했습니다. 위 통계는 그대로 볼 수 있습니다. 다시 분석하려면 분석하기를 누르세요.
          </p>
        )}
      </div>
    </section>
  );
}
