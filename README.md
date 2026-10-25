# er-research

이터널 리턴 스쿼드 랭크 경기를 모아서, **팀 조합별 승률**을 보여주는 웹 서비스입니다.

> 개발 중입니다. 지금은 가라데이터로 화면을 먼저 만들고 있습니다.

## 소개

함께 플레이할 실험체를 1~2개 고르면, 남은 자리에 어떤 실험체가 들어갔을 때 승률이 높았는지 보여줍니다.

- **조합 단위**: 실험체 + 핵심 특성 + 무기
- **정렬**: 1위율, TOP3율, 평균 순위, 표본 수
- **필터**: 시즌, 티어 구간 (다이아몬드 / 메테오라이트 / 미스릴 / 상위 1000위)

공식 Open API에는 조합별 승률을 주는 엔드포인트가 없습니다. 그래서 수집기가 경기 데이터를 모아 DB에 쌓고, 페이지는 그 데이터를 직접 집계해서 보여줍니다.

```
Open API → 수집기 → SQLite → Next.js 페이지
```

## 기술 스택

| 분류 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router), React 19 |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS v4 |
| 클라이언트 상태 | Zustand (선택한 조합, 필터, 정렬) |
| 서버 데이터 | TanStack Query |
| DB | SQLite (better-sqlite3), Drizzle ORM |
| 린트 | ESLint 9, @stylistic/eslint-plugin |
| 패키지 매니저 | pnpm |

## 실행

```bash
pnpm install
pnpm dev
```

API 키는 [Eternal Return Developers](https://developer.eternalreturn.io)에서 발급받아 `.env.local`에 넣습니다.

```
ER_API_KEY=발급받은_키
```

## 고지

이 프로젝트는 이터널 리턴의 비공식 팬 프로젝트이며, (주)님블뉴런과 관련이 없습니다. 게임 데이터는 [이터널 리턴 Open API 이용약관](https://support.playeternalreturn.com/hc/en-us/articles/49090866623257)을 따릅니다.
