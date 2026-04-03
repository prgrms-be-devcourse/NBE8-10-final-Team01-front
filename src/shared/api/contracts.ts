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
  requiredCount: number;
}

export interface QueueStatusResponse {
  message: string;
  category: string;
  difficulty: string;
  waitingCount: number;
  requiredCount: number;
}

export interface ReadyCheckParticipant {
  userId: number;
  nickname: string;
  decision: "PENDING" | "ACCEPTED" | "DECLINED";
}

export interface ReadyCheckState {
  matchId: number;
  acceptedCount: number;
  requiredCount: number;
  acceptedByMe: boolean;
  deadline: string;
  participants: ReadyCheckParticipant[];
}

export interface MatchRoomInfo {
  roomId: number;
}

export interface MatchStateResponse {
  status: "IDLE" | "ACCEPT_PENDING" | "ROOM_READY" | "EXPIRED" | "CANCELLED";
  readyCheck: ReadyCheckState | null;
  room: MatchRoomInfo | null;
  message: string | null;
}

export interface QueueStateChangedWsMessage {
  type: "QUEUE_STATE_CHANGED";
  queue: QueueStateResponse | null;
  match: null;
}

export interface ReadyCheckStartedWsMessage {
  type: "READY_CHECK_STARTED";
  queue: null;
  match: MatchStateResponse | null;
}

export type MatchingWsMessage =
  | QueueStateChangedWsMessage
  | ReadyCheckStartedWsMessage;

export interface ParticipantInfo {
  userId: number;
  nickname: string;
  status: "READY" | "PLAYING" | "EXIT" | "ABANDONED";
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

export interface BattleRoomStateResponse {
  myCode: string | null;
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
  supportedLanguages?: string[];
  defaultLanguage?: string;
  starterCodes?: ProblemStarterCode[];
  sampleCases?: ProblemSampleCase[];
}

export interface ProblemStarterCode {
  language: string;
  code: string;
}

export interface ProblemSampleCase {
  input: string;
  output: string;
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

export interface RunPayload {
  roomId: number;
  code: string;
  language: string;
}

export interface RunTestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  status: string;
  stderr: string | null;
}

export interface RunWsMessage {
  type: "RUN_RESULT";
  userId: number;
  results: RunTestCaseResult[];
}

export interface SoloRunRequest {
  code: string;
  language: string;
}

export interface SoloRunResponse {
  message: string;
}

export interface SoloSubmitRequest {
  code: string;
  language: string;
}

export interface SoloRunTestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  status: string;
  stderr: string | null;
}

export interface SoloRunWsMessage {
  type: "RUN_RESULT";
  userId: number;
  results: SoloRunTestCaseResult[];
}

export interface SubmissionResponse {
  submissionId: number;
  result: string | null;
  passedCount: number;
  totalCount: number;
}

export interface SubmissionWsMessage {
  type: "SUBMISSION";
  userId: number;
  result: string;
  passedCount: number;
  totalCount: number;
}

export interface CodeUpdateWsMessage {
  type: "CODE_UPDATE";
  userId: number;
  code: string;
}

export interface ParticipantDoneWsMessage {
  type: "PARTICIPANT_DONE";
  userId: number;
  rank: number;
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
