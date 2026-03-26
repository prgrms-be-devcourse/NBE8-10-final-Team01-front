export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface RsData<T> {
  resultCode: string;
  msg: string;
  data: T;
}

export interface ApiErrorResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JoinRequest {
  email: string;
  password: string;
  passwordConfirm: string;
  name: string;
}

export interface SessionMember {
  memberId: number;
  email: string;
  nickname: string;
  role: string;
}

export interface SessionResponse {
  authenticated: boolean;
  member: SessionMember | null;
}

export interface AuthMutationResponse extends SessionResponse {
  message: string;
}

export interface QueueJoinRequest {
  category: string;
  difficulty: Difficulty;
}

export interface QueueStateResponse {
  inQueue: boolean;
  category: string | null;
  difficulty: string | null;
  waitingCount: number;
}

export interface QueueStatusResponse {
  message: string;
  category: string;
  difficulty: string;
  waitingCount: number;
}

export interface MatchStatusResponse {
  status: "IDLE" | "SEARCHING" | "MATCHED";
  roomId: number | null;
}

export interface ParticipantInfo {
  userId: number;
  nickname: string;
  status: "READY" | "PLAYING" | "EXIT";
}

export interface RoomResponse {
  roomId: number;
  problemId: number;
  status: "WAITING" | "PLAYING" | "FINISHED";
  maxPlayers: number;
  timerEnd: string | null;
  participants: ParticipantInfo[];
}

export interface JoinRoomResponse {
  roomId: number;
  status: string;
  timerEnd: string | null;
}

export interface ProblemDetailResponse {
  problemId: number;
  title: string;
  difficulty: string;
  content: string;
  inputFormat: string;
  outputFormat: string;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface ProblemSummaryResponse {
  problemId: number;
  title: string;
  difficulty: string;
  difficultyRating: number;
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface ProblemPageInfo {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface ProblemListResponse {
  problems: ProblemSummaryResponse[];
  pageInfo: ProblemPageInfo;
}

export interface SubmitPayload {
  roomId: number;
  code: string;
  language: string;
}

export interface SubmissionResponse {
  submissionId: number;
  result: string | null;
  passedCount: number;
  totalCount: number;
}

export interface BattleResultParticipant {
  userId: number;
  nickname: string;
  finalRank: number;
  scoreDelta: number;
  result: string | null;
  passedCount: number;
  totalCount: number;
  finishTime: string | null;
}

export interface BattleResultResponse {
  roomId: number;
  problemTitle: string;
  participants: BattleResultParticipant[];
}

export interface MyBattleResultItem {
  roomId: number;
  problemId: number;
  problemTitle: string;
  finalRank: number;
  scoreDelta: number;
  solved: boolean;
  finishTime: string | null;
  playedAt: string;
}

export interface PageInfo {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface MyBattleResultsData {
  battleResults: MyBattleResultItem[];
  pageInfo: PageInfo;
}

export type MyBattleResultsResponse = RsData<MyBattleResultsData | null>;

export interface RoomListResponse {
  roomId: number;
  status: string;
  problemTitle: string;
  currentPlayers: number;
  maxPlayers: number;
}
