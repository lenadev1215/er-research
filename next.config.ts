import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // 배포본은 pnpm snapshot으로 만든 공개용 사본만 함수 번들에 넣는다. 원본(닉네임 포함)은 넣지 않는다.
  outputFileTracingIncludes: {
    "/**": [ "./data/er-public.db" ],
  },
  outputFileTracingExcludes: {
    "/**": [ "./data/er.db", "./data/er.db-*" ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: [ "@tailwindcss/turbopack" ],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
