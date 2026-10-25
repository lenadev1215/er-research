# Open API 조사 노트

2026-10-25에 실제 응답으로 확인한 내용이다. 문서(스웨거)에는 설명이 거의 없어서 직접 호출해 정리했다.

## 기본

- Base: `https://open-api.bser.io`
- 인증: `x-api-key` 헤더. 키가 틀리거나 비활성 상태면 `403 {"message":"Forbidden"}` (키 없이 보낸 것과 같은 응답)
- 스웨거의 Try it out은 CORS 때문에 브라우저에서 `Failed to fetch`가 난다. curl로 확인한다.
- 응답 형태: `{ "code": 200, "message": "Success", ... }`. HTTP 상태가 200이어도 body의 `code`가 401·404일 수 있다. **body의 `code`를 확인해야 한다.**
- 호출 제한: 응답 헤더에 제한 정보가 없다. 1.1초 간격으로 20회가량 호출했을 때 429는 없었다.

## 엔드포인트

| 용도 | 경로 | 비고 |
|---|---|---|
| metaType 목록 | `GET /v1/data/hash` | 146종. `{ 이름: 해시 }` |
| 메타 데이터 | `GET /v1/data/{metaType}` | 아래 "메타 주의사항" 참고 |
| 번역 | `GET /v1/l10n/Korean` | 파일 URL을 돌려준다. 파일은 CDN에서 키 없이 받는다 |
| 상위 랭커 | `GET /v1/rank/top/{seasonId}/{teamMode}` | 1001명. `nickname, rank, mmr` — **userId 없음** |
| 닉네임 → 유저 | `GET /v1/user/nickname?query={닉네임}` | `{ user: { nickname, userId } }`. userId는 문자열 |
| 유저 경기 목록 | `GET /v1/user/games/uid/{userId}` | 10판씩. `next`(gameId)로 다음 페이지 |
| 경기 상세 | `GET /v1/games/{gameId}` | 참가자 전원. **닉네임만 있고 userId 없음** |

- `/v1/user/games/{userId}`(uid 없는 경로)는 body `code: 401`을 돌려준다. `uid` 경로를 쓴다.
- 현재 시즌 ID: **41** (2026-10-25 기준). `rank/top/42/3`부터 404.

## 수집 흐름

```
rank/top → 닉네임
  → user/nickname → userId
  → user/games/uid → gameId 목록 (next로 페이지네이션)
  → games/{gameId} → 참가자 닉네임 → (다시 user/nickname …)
```

유저 한 명을 확장하는 데 최소 2회 호출이 든다 (닉네임 조회 + 경기 목록).

## 경기 레코드 (필드 326개 중 사용하는 것)

| 필드 | 예시 | 용도 |
|---|---|---|
| `gameId` | 66952775 | 경기 키 |
| `seasonId` | 41 | 시즌 필터 |
| `matchingMode` | 3 | 3 = 랭크 |
| `matchingTeamMode` | 3 | 3 = 스쿼드 |
| `versionMajor`, `versionMinor` | 6, 0 | 패치 필터 후보 |
| `startDtm` | `2026-10-25T16:30:43.043+0900` | |
| `matchSize` | 21 | 참가 인원 |
| `mmrAvg` | 9012 | 경기 평균 MMR |
| `teamNumber` | 2 | **연속되지 않는다** (예: 1,2,3,5,6,7,8) |
| `gameRank` | 1 | 팀 최종 순위 |
| `characterNum` | 85 | 실험체 코드. **다른 팀에 같은 실험체가 중복될 수 있다** |
| `bestWeapon` | 13 | 무기 숫자 코드 |
| `traitFirstCore` | 7200301 | 핵심 특성 |
| `traitFirstSub` | `[7200101, 7210801]` | 서브 특성 (사용 안 함) |
| `mmrBefore`, `mmrAfter`, `mmrGain` | 8777, 8822, 45 | RP |
| `victory` | 1 | 1위 여부 |
| `preMade` | 1 | 의미 미확인 (샘플은 전원 1) |

### 관찰

- 샘플 경기는 **7팀**이었다. 팀 수가 경기마다 다르므로 1위율 기준선은 `1 / 팀 수`로 계산해야 한다.
- 샘플에서 3위 팀(+60~64)이 1위 팀(+39~45)보다 RP를 더 얻었다. 순위와 RP는 따로 움직인다.

## 메타 주의사항

- **`Season`은 2023년 Season9(ID 17)에서 멈춰 있다.** `isCurrent`도 믿을 수 없다. 시즌은 경기 데이터의 `seasonId`로 판단한다.
- **`Character`는 64번까지만 있다.** 실제 경기에는 85, 89번 등이 나온다. 이름은 l10n에서 가져온다.
- `WeaponTypeInfo`는 23종인데 `Polearm`이 빠져 있다. 숫자 코드도 없다.
- `Trait`는 최신으로 보인다 (123종, 핵심 15종). `traitGroup`, `traitType`(Core/Sub) 포함.
- **l10n(Korean)은 최신이다** (2026-10-15 버전). 형식은 한 줄에 `키┃값`.
  - 실험체: `Character/Name/{code}`
  - 특성: `Trait/Name/{code}`
  - 무기: `MasteryType/{type}/...`

## 무기 코드 대응표 (추정, 검증 필요)

`bestWeapon` 숫자와 무기 종류를 대응시키는 공식 표가 없다. 아래는 추정이다. 실제 데이터와 2건 대조해 일치했다 (재키 14 = 도끼, 테오도르 11 = 저격총). 수집 후 실험체별 무기 분포로 전체를 검증한다.

| 코드 | 무기 | 코드 | 무기 |
|---|---|---|---|
| 1 | Glove 글러브 | 14 | Axe 도끼 |
| 2 | Tonfa 톤파 | 15 | OneHandSword 단검 |
| 3 | Bat 방망이 | 16 | TwoHandSword 양손검 |
| 4 | Whip 채찍 | 17 | Polearm 폴암 |
| 5 | HighAngleFire 투척 | 18 | DualSword 쌍검 |
| 6 | DirectFire 암기 | 19 | Spear 창 |
| 7 | Bow 활 | 20 | Nunchaku 쌍절곤 |
| 8 | CrossBow 석궁 | 21 | Rapier 레이피어 |
| 9 | Pistol 권총 | 22 | Guitar 기타 |
| 10 | AssaultRifle 돌격 소총 | 23 | Camera 카메라 |
| 11 | SniperRifle 저격총 | 24 | Arcana 아르카나 |
| 13 | Hammer 망치 | 25 | VFArm VF의수 |

12번은 비어 있는 것으로 추정한다.
