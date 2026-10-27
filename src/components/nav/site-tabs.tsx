"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "조합 분석" },
  { href: "/report", label: "전적 분석" },
] as const;

// 페이지 단위 이동이라 role="tablist" 대신 링크 목록 + aria-current로 둔다.
export function SiteTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="화면" className="border-b border-line">
      <ul className="mx-auto flex w-full max-w-5xl gap-6 px-4 sm:px-8">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vf ${
                  active ? "border-vf text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
