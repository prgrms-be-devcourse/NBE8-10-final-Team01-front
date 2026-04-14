import type { Difficulty } from "@/shared/api/contracts";

export const SEARCH_POLL_INTERVAL_MS = 1_000;
export const DEFAULT_REQUIRED_COUNT = 4;

export interface QueueCategoryOption {
  value: string;
  label: string;
  difficulties?: Difficulty[];
  disabled?: boolean;
}

export const queueCategories: QueueCategoryOption[] = [
  { value: "RANDOM", label: "전체 (무작위 준비 중)", disabled: true },
  { value: "dp", label: "DP" },
  { value: "graphs", label: "그래프" },
  { value: "strings", label: "문자열" },
  { value: "greedy", label: "그리디" },
  { value: "implementation", label: "구현" },
] as const;

export type QueueCategoryValue = string;

export const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
];

export const dashboardMenus = [
  {
    title: "메인 대시보드",
    description: "현재 매칭 상태와 화면 구조를 메인에서 바로 확인합니다.",
    href: "/",
    requiresAuth: false,
  },
  {
    title: "내 전적 조회",
    description: "프로필, 전적, 점수 변화는 마이페이지에서 확인합니다.",
    href: "/mypage",
    requiresAuth: true,
  },
  {
    title: "복습 일정",
    description: "현재는 화면만 열어두고 실제 일정 계약은 추후 연결합니다.",
    href: "/mypage",
    requiresAuth: true,
  },
  {
    title: "관전 목록",
    description: "진행 중인 방 목록과 관전 화면으로 이동합니다.",
    href: "/spectate",
    requiresAuth: true,
  },
];

export function getQueueCategoryLabel(
  category: string | null,
  categories: QueueCategoryOption[] = queueCategories,
) {
  if (!category) {
    return "-";
  }

  return categories.find((item) => item.value === category)?.label ?? category;
}

export function getReadyDecisionLabel(decision: "PENDING" | "ACCEPTED" | "DECLINED") {
  if (decision === "ACCEPTED") {
    return "수락";
  }

  if (decision === "DECLINED") {
    return "거절";
  }

  return "대기";
}

export function getReadyDecisionTone(decision: "PENDING" | "ACCEPTED" | "DECLINED") {
  if (decision === "ACCEPTED") {
    return "success" as const;
  }

  if (decision === "DECLINED") {
    return "danger" as const;
  }

  return "warn" as const;
}

export function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getElapsedSeconds(startedAt: string | null, now: number) {
  if (!startedAt) {
    return 0;
  }

  return Math.floor((now - new Date(startedAt).getTime()) / 1000);
}

export function getRemainingSeconds(deadline: string | null, now: number) {
  if (!deadline) {
    return 0;
  }

  return Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000));
}
