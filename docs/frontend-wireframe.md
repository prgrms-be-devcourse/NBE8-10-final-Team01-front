# 프론트 와이어프레임 정리

## 개요

이 문서는 프론트 와이어프레임이 어떤 백엔드 계약을 기준으로 만들어졌는지 정리한다.
현재 기준은 mock-only가 아니라 API 우선 연결이다.
이미 준비된 API는 실제로 붙이고, 아직 없는 항목만 임시 데이터나 placeholder로 처리한다.

프론트 구현 메모:
- 브라우저는 백엔드 대신 `app/api/**` BFF 라우트를 먼저 호출한다.
- 로그인 시 백엔드가 내려주는 `accessToken` 쿠키를 프론트 도메인 쿠키로 다시 설정해 로컬 개발 제약을 피한다.
- 현재 백엔드에는 `GET /api/v1/members/me`가 없으므로, 기본 세션 정보는 JWT payload에서 복원한다.

백엔드 기준 저장소:
- 형제 저장소: `../NBE8-10-final-Team01`

로컬 실행/데이터 적재 전제:
- 백엔드 저장소의 `docs/local-db-compose-guide.md`
- 문서 기준으로 PostgreSQL, Spring Boot, 샘플 데이터 적재가 먼저 준비되어야 실제 API 연결 검증이 가능하다.

## 프론트 서브에이전트 설계 (v2)

### 역할 정의

- 이름: `frontend-designer`
- 목표: 현재 코드베이스 기준으로 화면 설계와 API 연결 계획을 먼저 고정하고, 구현팀이 바로 작업 가능한 수준의 설계 산출물을 만든다.
- 책임 범위:
  - 라우트별 화면 구조/상태 전이 정의
  - `src/app/api/**` BFF 경유 기준의 API 연결 매핑
  - 백엔드 미계약 기능의 placeholder 정책 명시
- 제외 범위:
  - 백엔드 API 추가/수정
  - DB 스키마 변경
  - 기존 타 작업자 변경 롤백

### 필수 입력 컨텍스트

- 문서:
  - `docs/frontend-wireframe.md`
- 라우트 엔트리:
  - `src/app/page.tsx`
  - `src/app/login/page.tsx`
  - `src/app/signup/page.tsx`
  - `src/app/mypage/page.tsx`
  - `src/app/spectate/page.tsx`
  - `src/app/spectate/rooms/[roomId]/page.tsx`
  - `src/app/battle/rooms/[roomId]/page.tsx`
  - `src/app/battle/results/[roomId]/page.tsx`
- 기능 화면:
  - `src/features/home/screen.tsx`
  - `src/features/login/screen.tsx`
  - `src/features/signup/screen.tsx`
  - `src/features/my-page/screen.tsx`
  - `src/features/spectate/screen.tsx`
  - `src/features/spectate-room/screen.tsx`
  - `src/features/battle-room/screen.tsx`
  - `src/features/battle-result/screen.tsx`
- BFF/API 계약:
  - `src/app/api/auth/*`
  - `src/app/api/queue/*`
  - `src/app/api/battle/rooms/*`
  - `src/app/api/problems/[problemId]/route.ts`
  - `src/app/api/submissions/route.ts`
  - `src/shared/api/contracts.ts`
  - `src/shared/api/backend.ts`
  - `src/shared/auth/session.ts`
- 레거시 참고:
  - `src/app/api/matches/**`는 `/api/v1/matchs/*` 임시 중계 경로이므로 신규 핵심 플로우 기준으로 사용하지 않는다.

### 작업 절차

1. 설계 동결
   - 라우트별 `브라우저 -> BFF -> 백엔드` 호출 체인을 1개로 고정한다.
   - 화면별 인증 필요 여부와 실패 시 이동 경로를 고정한다.
2. 화면 계약 정리
   - 각 화면에서 쓰는 DTO를 `src/shared/api/contracts.ts` 타입명 기준으로 명시한다.
   - 타입에 없는 필드는 사용 금지로 표시한다.
3. 미계약 기능 처리
   - `disabled UI`, `placeholder`, `fixture` 중 하나로 분류한다.
   - 사용자에게 보이는 안내 문구도 같이 설계한다.
4. 인수인계 문서화
   - 구현자가 바로 시작할 수 있도록 파일 경로 단위 작업 목록을 남긴다.

### 산출물 포맷

- 필수 산출물 1: 라우트별 설계표
  - 항목: `route`, `auth`, `bff endpoint`, `backend endpoint`, `dto`, `fallback`
- 필수 산출물 2: 구현 백로그(우선순위 1~5)
  - 항목: `우선순위`, `대상 파일`, `작업 내용`, `완료 조건`
- 필수 산출물 3: 리스크/블로커
  - 항목: `이슈`, `원인`, `임시 대응`, `백엔드 필요 계약`

### 완료 기준 (DoD)

- 설계표가 `src/app`, `src/features`, `src/app/api`, `src/shared/api/contracts.ts`와 충돌하지 않는다.
- 모든 사용자 요청 경로가 프론트 BFF(`/api/**`) 기준으로 정리되어 있다.
- 미계약 영역이 숨겨지지 않고 명시적으로 표기되어 있다.
- 구현 백로그가 파일 경로 단위로 분해되어 바로 작업 가능하다.

### 가드레일

- 클라이언트에서 백엔드 직접 호출을 새로 만들지 않는다.
- DTO 추측 필드를 추가하지 않는다.
- `/api/matches/**`를 신규 표준 경로처럼 확장하지 않는다.
- 미구현 기능을 완성 기능처럼 보이게 하지 않는다.
- 다른 작업자 변경을 임의로 되돌리지 않는다.

### 시작 백로그 (설계 우선)

1. 인증/세션 플로우 확정
   - 파일: `src/app/api/auth/*`, `src/shared/auth/session.ts`, `src/features/login/screen.tsx`
2. 메인 큐 플로우 확정
   - 파일: `src/features/home/*`, `src/app/api/queue/*`
3. 배틀룸 화면 상태 전이 확정
   - 파일: `src/features/battle-room/*`, `src/app/api/battle/rooms/*`, `src/app/api/problems/*`
4. 결과/관전 화면 연결 확정
   - 파일: `src/features/battle-result/*`, `src/features/spectate*/*`, `src/app/api/battle/rooms/[roomId]/result/route.ts`
5. 마이페이지 placeholder 정책 확정
   - 파일: `src/features/my-page/*`

### 서브에이전트 실행 프롬프트 템플릿

```text
당신은 frontend-designer 서브에이전트입니다.
목표: 현재 저장소에서 프론트 설계를 먼저 고정합니다.

반드시 참조:
- docs/frontend-wireframe.md
- src/app/**/page.tsx
- src/features/**/screen.tsx
- src/app/api/**
- src/shared/api/contracts.ts
- src/shared/auth/session.ts

출력 형식:
1) 라우트별 설계표(route/auth/bff/backend/dto/fallback)
2) 구현 백로그(우선순위 1~5, 파일 경로 포함)
3) 리스크/블로커(임시 대응 + 필요한 백엔드 계약)

규칙:
- 브라우저는 반드시 /api/** BFF를 호출
- contracts.ts에 없는 필드 가정 금지
- /api/matches/**는 레거시로만 취급
- 미계약 기능은 placeholder/disabled로 명시
```

## 라우트와 사용자 흐름

### `/`

- 목적: 메인 대시보드이자 매칭 시작 화면
- 기본 동작:
  - 비로그인 상태에서도 진입은 가능하다.
  - 다만 매칭 시작, 마이페이지 이동 같은 보호 기능을 누르면 `/login`으로 이동시킨다.
- 로그인 후 주요 구성:
  - 상단바: 로고, 내 프로필 요약, 로그아웃
  - 메인 기능: 카테고리와 난이도를 선택하고 큐를 잡는 영역
  - 보조 정보: 개인 통계 요약, 최근 점수 흐름, 메뉴 진입
- 메모: 메인 페이지의 가장 중요한 기능은 "매칭 시작"이다.

### `/login`

- 목적: 로그인 전용 페이지
- 대응 엔드포인트:
  - `POST /api/auth/login`
  - `POST /api/v1/members/login`
- 표시 DTO:
  - `LoginRequest`
- 보조 흐름:
  - 회원가입이 안 된 사용자는 `/signup`으로 이동
  - 비밀번호 찾기, 소셜 로그인은 현재 백엔드 계약이 없으므로 UI만 임시 배치 가능

### `/signup`

- 목적: 회원가입 전용 페이지
- 대응 엔드포인트:
  - `POST /api/auth/signup`
  - `POST /api/v1/members/join`
- 표시 DTO:
  - `JoinRequest`
- 기본 흐름:
  - 가입 완료 후 `/login`으로 이동

### 메인 내 매칭 영역

- 위치: 별도 페이지보다 `/` 내부의 핵심 섹션으로 본다.
- 목적: category + difficulty 기반 큐 진입 구조 표현
- 대응 엔드포인트:
  - `GET /api/queue/me`
  - `POST /api/queue/join`
  - `DELETE /api/queue/cancel`
  - `GET /api/v1/queue/me?userId={id}`
  - `POST /api/v1/queue/join?userId={id}`
  - `DELETE /api/v1/queue/cancel?userId={id}`
- 표시 DTO:
  - `QueueJoinRequest`
  - `QueueStateResponse`
  - `QueueStatusResponse`
- 매칭 정책:
  - 큐는 최대 4명 고정
  - 같은 조건에서 4명이 모이면 방 생성
  - 현재 응답은 `roomId`를 별도 필드로 주지 않고 메시지에 포함하므로, 프론트는 메시지 문자열에서 `roomId`를 읽어 `/battle/rooms/[roomId]`로 이동한다.
  - `전체(무작위)`는 현재 백엔드 문제 선정기와 맞지 않아 프론트에서 비활성화한다.
  - 프론트 카테고리 값은 백엔드 실제 태그명과 맞춰야 한다. 현재 사용 값은 `dp`, `graphs`, `strings`, `greedy`, `implementation`이다.

### `/problems`

- 위치: 네비게이션에서 직접 진입하는 독립 라우트
- 목적: 매칭 화면과 분리해 문제 전체를 페이지 단위로 빠르게 탐색
- 대응 엔드포인트:
  - `GET /api/problems?page={page}&size={size}`
  - `GET /api/v1/problems?page={page}&size={size}`
- 표시 DTO:
  - `ProblemListResponse`
  - `ProblemSummaryResponse`
  - `ProblemPageInfo`
- 동작:
  - 로그인 사용자는 페이징 목록을 조회한다.
  - 비로그인 사용자는 목록 대신 로그인 유도 화면을 표시한다.
  - 현재 기본 페이지 사이즈는 프론트에서 `20`으로 고정한다.
  - 페이지 이동은 `이전/다음` + 숫자 버튼(예: `1 2 3 4`)을 함께 제공한다.
  - 목록에서 문제를 선택하면 `/problems/[problemId]`로 이동한다.

### `/problems/[problemId]`

- 위치: 문제 목록에서 선택 시 진입하는 개인 풀이 전용 화면
- 목적: 멀티 룸과 분리해 문제 본문 확인 + 에디터 기반 개인 풀이 수행
- 대응 엔드포인트:
  - `GET /api/problems/{problemId}`
  - `GET /api/v1/problems/{problemId}`
- 표시 DTO:
  - `ProblemDetailResponse`
- 동작:
  - 큐/매칭/소켓 없이 문제와 코드 작성에 집중한다.
  - 코드는 브라우저 localStorage에 저장한다.
  - Run/Submit은 솔로 전용 실행 계약이 생기기 전까지 연결하지 않는다.

### `/battle/rooms/[roomId]`

- 목적: WAITING, PLAYING 상태를 같은 라우트에서 표현하는 핵심 문제 풀이 화면
- 대응 엔드포인트:
  - `GET /api/battle/rooms/{roomId}`
  - `POST /api/battle/rooms/{roomId}/join`
  - `GET /api/problems/{problemId}`
  - `POST /api/submissions`
  - `POST /api/v1/battle/rooms`
  - `POST /api/v1/battle/rooms/{roomId}/join`
  - `GET /api/v1/battle/rooms/{roomId}`
  - `GET /api/v1/problems/{problemId}`
  - `POST /api/v1/submissions`
- 표시 DTO:
  - `CreateRoomResponse`
  - `JoinRoomResponse`
  - `RoomResponse`
  - `ProblemDetailResponse`
  - `SubmitRequest`
  - `SubmissionResponse`
- 화면 핵심:
  - 좌측 문제 영역
  - 우측 코드 에디터
  - 상단 참가자 상태 및 실시간 채점 알림
  - 하단 퇴장 버튼
- 종료 흐름:
  - 제한 시간 종료 또는 전원 완료 시 결과 페이지로 이동

### `/battle/results/[roomId]`

- 목적: 정산 완료된 방의 결과 요약 화면
- 대응 엔드포인트:
  - `GET /api/v1/battle/rooms/{roomId}/result`
- 표시 DTO:
  - `BattleResultResponse`
- 기본 흐름:
  - 결과 확인 후 메인 `/`으로 돌아간다.

### `/mypage`

- 목적: 프로필, 전적, 점수와 티어 변동 확인
- 현재 백엔드 상태:
  - 현재 `GET /api/v1/members/me`가 없다.
  - 프론트는 로그인 세션의 JWT payload에서 `memberId`, `email`, `nickname`, `role`만 복원할 수 있다.
  - 전적 리스트와 점수 그래프는 아직 별도 계약이 없을 수 있으므로 우선 placeholder 또는 임시 데이터로 설계한다.

### `/spectate`

- 목적: 진행 중인 방 목록을 관전 허브로 제공
- 대응 엔드포인트:
  - `GET /api/v1/battle/rooms`
- 표시 DTO:
  - `RoomListResponse`

### `/spectate/rooms/[roomId]`

- 목적: 관전자 전용 코드 스트림과 이벤트 로그 표현
- 대응 WebSocket 경로:
  - handshake `/ws`
  - subscribe `/topic/room/{roomId}`
  - subscribe `/topic/room/{roomId}/spectate`
  - send `/app/room/{roomId}/code`
- 관련 이벤트 라벨:
  - `BATTLE_STARTED`
  - `SUBMISSION`
  - `PARTICIPANT_DONE`
  - `BATTLE_FINISHED`
  - `CODE_UPDATE`

## 현재 백엔드 제약

- 문제 목록 API는 제공되지만, 현재는 페이지네이션(`page`, `size`)만 지원한다.
- 검색, 카테고리 필터, 난이도 필터는 아직 별도 계약이 없다.
- 큐 진입과 제출은 아직 `userId`를 쿼리 또는 본문으로 직접 받는다.
- 큐는 현재 서비스 로직상 4명 고정으로 방을 만든다.
- 로그인 응답 쿠키는 현재 백엔드 코드상 `Secure=true`, `Domain=localhost`로 설정돼 있어, 로컬 개발에서는 프론트 BFF 중계가 사실상 필요하다.
- 제출 채점은 현재 `SubmissionService`에서 Mock AC 기준이다.
- LeetCode식 `Run` 기능은 아직 없다. 현재 백엔드는 제출 API만 있고, 실행 전용 endpoint와 stdout/stderr 응답 계약이 없다.
- 정산 결과는 방 상태가 `FINISHED`일 때만 조회 가능하다.
- WebSocket 메시지는 트랜잭션 커밋 후 전송 보장이 아직 TODO 상태다.
- 전적 조회, 점수 그래프, 비밀번호 찾기, 소셜 로그인은 현재 백엔드 계약이 불명확하거나 아직 없다.

## 실제 연동 시 후속 작업

- 실제 fetch로 붙일 때도 DTO 필드명은 유지한다.
- 동적 라우트는 실제 roomId 기반으로 유지하고, 현재의 sample `generateStaticParams`는 제거하거나 API 기반으로 바꾼다.
- 카테고리 목록은 백엔드 API가 생기기 전까지 상수로 유지한다.
- 인증 연결 시 HttpOnly 쿠키 흐름을 기준으로 클라이언트 상태 모델을 설계한다.
- 메인 `/`는 비로그인과 로그인 상태를 모두 처리하는 화면으로 설계한다.
- 비로그인 사용자의 보호 기능 진입 시 `/login`으로 보내는 가드 로직을 둔다.
- 큐를 잡으면 메인 위에 대기 모달을 띄우고, 매칭 성사 시 즉시 이동하지 않고 수락 버튼을 한 번 더 받는 흐름을 우선한다.
- 다만 현재 백엔드에는 모든 참가자에게 `roomId`를 알려주는 계약이 없어, 완전한 4인 ready-check는 후속 API가 필요하다.
- 그 전까지 프론트는 동일 브라우저 탭 기준 `BroadcastChannel`로 ready-check UI를 임시 동기화한다. 실제 배포 기준에서는 backend contract로 교체해야 한다.
- `members`, `queue`, `battle`, `problems`, `submissions` 관련 화면은 가능한 한 실제 API 연결을 우선한다.
