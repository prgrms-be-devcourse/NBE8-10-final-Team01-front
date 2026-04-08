import type {
  ProblemDetailResponse,
  RoomResponse,
  SubmitPayload,
} from "@/shared/api/contracts";

export interface LiveEvent {
  timestamp: string;
  type: string;
  headline: string;
  detail: string;
}

export const submitTemplate: SubmitPayload = {
  roomId: 302,
  code: `function solve(input) {\n  const values = input.trim().split(/\\s+/).map(Number);\n  const n = values[0];\n  const nums = values.slice(1, n + 1);\n  return String(nums.reduce((sum, value) => sum + value, 0));\n}`,
  language: "javascript",
};

const room302Events: LiveEvent[] = [
  {
    timestamp: "18:00:00",
    type: "BATTLE_STARTED",
    headline: "배틀 시작",
    detail: "모든 참여자가 PLAYING 상태가 되며 30분 타이머가 시작됐다.",
  },
  {
    timestamp: "18:08:44",
    type: "SUBMISSION",
    headline: "첫 제출",
    detail: "graph_cat가 AC를 받았고 passedCount 12/12가 브로드캐스트됐다.",
  },
  {
    timestamp: "18:09:03",
    type: "PARTICIPANT_DONE",
    headline: "완주 알림",
    detail: "graph_cat가 1등으로 종료됐다는 이벤트가 수신됐다.",
  },
  {
    timestamp: "18:19:20",
    type: "BATTLE_FINISHED",
    headline: "정산 완료",
    detail:
      "모든 참여자 상태를 기반으로 결과 정산이 끝났고 결과 화면으로 이동할 수 있다.",
  },
];

export const problemDetailsById: Record<number, ProblemDetailResponse> = {
  101: {
    problemId: 101,
    language: "ko",
    title: "연속 구간의 최대 합",
    difficulty: "MEDIUM",
    content:
      "정수 N개가 주어진다. 한 번만 선택할 수 있는 연속 부분 수열의 합 중 최댓값을 구하라.\n\n배틀룸에서는 본문 전체 대신 핵심 제약과 예시를 빠르게 읽을 수 있도록 문제 본문, 입력 형식, 출력 형식, 제한을 분리해 배치한다.",
    inputFormat:
      "첫째 줄에 수열의 길이 N이 주어진다.\n둘째 줄에 공백으로 구분된 N개의 정수가 주어진다.",
    outputFormat: "연속 부분 수열의 합 중 최댓값을 한 줄에 출력한다.",
    timeLimitMs: 1000,
    memoryLimitMb: 256,
  },
  102: {
    problemId: 102,
    language: "ko",
    title: "단방향 그래프 최단 탈출",
    difficulty: "HARD",
    content:
      "N개의 노드와 M개의 단방향 간선이 주어진다. 시작점 1에서 도착점 N까지 가는 최단 거리와 경로 개수를 계산하라.\n\n실제 백엔드에는 문제 목록 API가 없으므로 와이어프레임에서는 문제 상세 응답 DTO 하나를 그대로 화면에 투영한다.",
    inputFormat:
      "첫째 줄에 N, M이 주어진다.\n이후 M개의 줄에 a, b, w가 주어진다. 이는 a에서 b로 가는 가중치 w의 간선을 뜻한다.",
    outputFormat:
      "최단 거리와 그러한 최단 경로의 개수를 공백으로 구분해 출력한다.",
    timeLimitMs: 2000,
    memoryLimitMb: 512,
  },
};

export const battleRoomsById: Record<number, RoomResponse> = {
  301: {
    roomId: 301,
    problemId: 101,
    status: "WAITING",
    maxPlayers: 4,
    timerEnd: null,
    participants: [
      { userId: 7, nickname: "algo_fox", status: "READY" },
      { userId: 12, nickname: "graph_cat", status: "READY" },
      { userId: 16, nickname: "dp_hawk", status: "READY" },
      { userId: 19, nickname: "queue_bear", status: "READY" },
    ],
  },
  302: {
    roomId: 302,
    problemId: 102,
    status: "PLAYING",
    maxPlayers: 4,
    timerEnd: "2026-03-24T18:30:00",
    participants: [
      { userId: 7, nickname: "algo_fox", status: "PLAYING" },
      { userId: 12, nickname: "graph_cat", status: "PLAYING" },
      { userId: 16, nickname: "dp_hawk", status: "PLAYING" },
      { userId: 19, nickname: "queue_bear", status: "PLAYING" },
    ],
  },
};

export const battleRoomEventsById: Record<number, LiveEvent[]> = {
  302: room302Events,
};

export function getBattleRoom(roomId: string) {
  return battleRoomsById[Number(roomId)] ?? null;
}

export function getProblemDetail(problemId: number) {
  return problemDetailsById[problemId] ?? null;
}

export function getBattleRoomEvents(roomId: string) {
  return battleRoomEventsById[Number(roomId)] ?? [];
}
