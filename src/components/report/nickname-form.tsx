"use client";

import { useState, type FormEvent } from "react";

type Props = {
  initial: string;
  busy: boolean;
  onSubmit: (nickname: string) => void;
};

const NICKNAME_MAX = 32;

export function NicknameForm({ initial, busy, onSubmit }: Props) {
  const [ value, setValue ] = useState(initial);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nickname = value.trim();
    if ( nickname ) onSubmit(nickname);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="report-nickname" className="text-sm font-medium text-ink">닉네임</label>
      <div className="flex gap-2">
        <input
          id="report-nickname"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={NICKNAME_MAX}
          autoComplete="off"
          spellCheck={false}
          aria-describedby="report-nickname-help"
          className="w-full max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          aria-busy={busy}
          className="shrink-0 rounded-md bg-vf px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf disabled:opacity-50"
        >
          {busy ? "분석 중" : "분석하기"}
        </button>
      </div>
      <p id="report-nickname-help" className="text-xs text-muted">
        최근 20판(코발트 제외)을 수집 데이터와 비교합니다. 닉네임과 조회 결과는 저장하지 않습니다.
      </p>
    </form>
  );
}
