export type SubmissionResult = "AC" | "WA" | "TLE" | "RE" | null;

export interface ParticipantResult {
  userId: number;
  nickname: string;
  finalRank: number;
  scoreDelta: number;
  result: SubmissionResult;
  passedCount: number;
  totalCount: number;
  finishTime: string | null;
}

export interface BattleResultResponse {
  roomId: number;
  problemTitle: string;
  participants: ParticipantResult[];
}

export const battleResultsByRoomId: Record<number, BattleResultResponse> = {
  401: {
    roomId: 401,
    problemTitle: "연속 구간의 최대 합",
    participants: [
      {
        userId: 12,
        nickname: "graph_cat",
        finalRank: 1,
        scoreDelta: 100,
        result: "AC",
        passedCount: 12,
        totalCount: 12,
        finishTime: "2026-03-24T18:12:14",
      },
      {
        userId: 7,
        nickname: "algo_fox",
        finalRank: 2,
        scoreDelta: 70,
        result: "AC",
        passedCount: 12,
        totalCount: 12,
        finishTime: "2026-03-24T18:13:49",
      },
      {
        userId: 16,
        nickname: "dp_hawk",
        finalRank: 3,
        scoreDelta: 40,
        result: "WA",
        passedCount: 9,
        totalCount: 12,
        finishTime: null,
      },
      {
        userId: 19,
        nickname: "queue_bear",
        finalRank: 4,
        scoreDelta: 20,
        result: null,
        passedCount: 0,
        totalCount: 12,
        finishTime: null,
      },
    ],
  },
};

export const sampleBattleResultIds = Object.keys(battleResultsByRoomId);

export function getBattleResult(roomId: string) {
  return battleResultsByRoomId[Number(roomId)] ?? null;
}
