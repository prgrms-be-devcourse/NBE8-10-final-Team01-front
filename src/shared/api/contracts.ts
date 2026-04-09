export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface ActiveRoomResponse {
  roomId: number;
}

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

export interface MyInfoResponse {
  memberId: number;
  nickname: string;
  email: string;
  score: number;
  tier: string;
  role: string;
  battleRating?: number | null;
  firstSolveScore?: number | null;
  tierScore?: number | null;
  battleMatchCount?: number | null;
  firstSolvedProblemCount?: number | null;
  solved1400Plus?: number | null;
  solved1700Plus?: number | null;
  solved2000Plus?: number | null;
  solved2300Plus?: number | null;
  recentTop2Rate?: number | null;
}

export type MyInfoApiResponse = RsData<MyInfoResponse | null>;

export interface RatingRequirementProgress {
  key: string;
  label: string;
  comparison: "AT_LEAST" | "AT_MOST";
  current: number;
  required: number;
  remaining: number;
  satisfied: boolean;
}

export interface NextTierProgress {
  tier: string;
  eligibleNow: boolean;
  message: string;
  seatRank?: number | null;
  requirements: RatingRequirementProgress[];
}

export interface CurrentTierProgress {
  displayTier: string;
  tier: string;
  battleRating: number;
  activityPoint: number;
  battleMatchCount: number;
  firstSolvedProblemCount: number;
  solved1400Plus: number;
  solved1700Plus: number;
  solved2000Plus: number;
  solved2300Plus: number;
  recentTop2Ratio: number;
}

export interface RatingProgressResponse {
  current: CurrentTierProgress;
  next: NextTierProgress | null;
}

export type RatingProgressApiResponse = RsData<RatingProgressResponse | null>;

export interface RankingDashboardProfile {
  memberId: number;
  nickname: string;
  tier: string;
  rank: number;
  percentile: number;
  score: number;
  battleRating: number;
  nextTier: string | null;
  battleMatchCount: number;
  top2Rate: number;
  top2SampleSize: number;
  scoreDeltaTotal: number;
}

export interface RankingDashboardTrendPoint {
  label: string;
  occurredAt: string;
  score: number;
  delta: number;
}

export interface RankingDashboardGateProgress {
  key: string;
  label: string;
  current: number;
  target: number;
  suffix: string;
}

export interface RankingDashboardNearbyRank {
  rank: number;
  memberId: number;
  nickname: string;
  tier: string;
  score: number;
  isMe: boolean;
}

export interface RankingDashboardTierDistribution {
  tier: string;
  count: number;
  percentage: number;
  isMyTier: boolean;
}

export interface RankingDashboardTagStat {
  tag: string;
  solvedCount: number;
  submissionCount: number;
  accuracy: number;
}

export interface RankingDashboardReviewSummary {
  dueTodayCount: number;
  upcomingCount: number;
}

export interface RankingDashboardResponse {
  profile: RankingDashboardProfile;
  scoreTrend: RankingDashboardTrendPoint[];
  gateProgress: RankingDashboardGateProgress[];
  nearbyRanking: RankingDashboardNearbyRank[];
  tierDistribution: RankingDashboardTierDistribution[];
  tagStats: RankingDashboardTagStat[];
  reviewSummary: RankingDashboardReviewSummary;
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

export interface ReadyDecisionChangedWsMessage {
  type: "READY_DECISION_CHANGED";
  queue: null;
  match: MatchStateResponse | null;
}

export interface MatchCancelledWsMessage {
  type: "MATCH_CANCELLED";
  queue: null;
  match: MatchStateResponse | null;
}

export interface MatchExpiredWsMessage {
  type: "MATCH_EXPIRED";
  queue: null;
  match: MatchStateResponse | null;
}

export interface RoomReadyWsMessage {
  type: "ROOM_READY";
  queue: null;
  match: MatchStateResponse | null;
}

export type MatchingWsMessage =
  | QueueStateChangedWsMessage
  | ReadyCheckStartedWsMessage
  | ReadyDecisionChangedWsMessage
  | MatchCancelledWsMessage
  | MatchExpiredWsMessage
  | RoomReadyWsMessage;

export interface ParticipantInfo {
  userId: number;
  nickname: string;
  status: "READY" | "PLAYING" | "SOLVED" | "ABANDONED" | "TIMEOUT" | "QUIT";
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
  language: string;
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

export interface CodeSyncWsMessage {
  type: "CODE_SYNC";
  userId: number;
  code: string;
}

export interface BattleFinishedWsMessage {
  type: "BATTLE_FINISHED";
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

export interface BattleResultWsMessage {
  type: "BATTLE_RESULT";
  roomId: number;
  rank: number;
  scoreDelta: number;
}

export interface UncheckedBattleResult {
  roomId: number;
  rank: number;
  scoreDelta: number;
  problemTitle: string;
}

export interface ReviewScheduleResponse {
  reviewCount: number;
  isReviewRequired: boolean;
}

export interface TodayReviewItem {
  problemId: number;
  problemTitle: string;
  difficulty: string;
  difficultyRating: number | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  reviewCount: number;
}

export interface TodayReviewResponse {
  totalCount: number;
  reviews: TodayReviewItem[];
}

export interface AdminProblemStarterCodeRequest {
  language: string;
  code: string;
  isDefault: boolean;
}

export interface AdminProblemTestCaseRequest {
  input: string;
  output: string;
}

export interface AdminProblemUpsertRequest {
  sourceProblemId?: string;
  title: string;
  difficulty: Difficulty;
  content: string;
  difficultyRating: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  inputFormat: string | null;
  outputFormat: string | null;
  inputMode?: "STDIO" | "FILE";
  judgeType?: "EXACT" | "CHECKER";
  checkerCode: string | null;
  tags: string[];
  starterCodes?: AdminProblemStarterCodeRequest[];
  sampleCases: AdminProblemTestCaseRequest[];
  hiddenCases: AdminProblemTestCaseRequest[];
}

export interface AdminProblemBulkRequest {
  problems: AdminProblemUpsertRequest[];
  validationToken?: string;
}

export interface AdminProblemMutationResponse {
  problemId: number;
  mode: "CREATED" | "UPDATED";
  sourceProblemId: string;
  title: string;
}

export interface AdminProblemValidationError {
  index: number;
  field: string;
  message: string;
}

export interface AdminProblemBulkValidateResponse {
  total: number;
  validCount: number;
  errors: AdminProblemValidationError[];
  validationToken?: string | null;
}

export interface AdminProblemSingleValidationError {
  field: string;
  message: string;
}

export interface AdminProblemSingleValidateResponse {
  valid: boolean;
  errors: AdminProblemSingleValidationError[];
}

export interface AdminProblemBulkImportResponse {
  total: number;
  inserted: number;
  updated: number;
  problemIds: number[];
}
