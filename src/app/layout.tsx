import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Sans_KR } from "next/font/google";
import { SiteTabs } from "@/components/nav/site-tabs";
import "./globals.css";
import { Providers } from "./providers";

const plexKr = IBM_Plex_Sans_KR({
  variable: "--font-plex-kr",
  weight: [ "400", "500", "600", "700" ],
  subsets: [ "latin" ],
});

// 티어 등급 글자 전용
const shoulders = Big_Shoulders({
  variable: "--font-shoulders",
  weight: [ "700", "800" ],
  subsets: [ "latin" ],
});

export const metadata: Metadata = {
  title: "er-research",
  description: "이터널 리턴 스쿼드 팀원 조합 분석",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${plexKr.variable} ${shoulders.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteTabs />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
