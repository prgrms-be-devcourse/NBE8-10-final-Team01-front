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

- 문제 목록 API가 아직 없다. 프론트는 문제 상세 단건 응답만 사용한다.
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
