import type { Difficulty } from "@/shared/api/contracts";

export const SEARCH_POLL_INTERVAL_MS = 1_000;

export const queueCategories: Array<{
  value:
    | "RANDOM"
    | "dp"
    | "graphs"
    | "strings"
    | "greedy"
    | "implementation";
  label: string;
  disabled?: boolean;
}> = [
  { value: "RANDOM", label: "전체 (무작위, 준비 중)", disabled: true },
  { value: "dp", label: "DP" },
  { value: "graphs", label: "그래프" },
  { value: "strings", label: "문자열" },
  { value: "greedy", label: "그리디" },
  { value: "implementation", label: "구현" },
] as const;

export const difficultyOptions: Array<{ value: Difficulty; label: string }> = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
];

export const dashboardMenus = [
  {
    title: "대시보드",
    description: "현재 큐 상태와 핵심 진입점을 한 화면에서 확인합니다.",
    href: "/",
    requiresAuth: false,
  },
  {
    title: "전적 조회",
    description: "프로필, 점수, 티어 변화는 마이페이지에서 확인합니다.",
    href: "/mypage",
    requiresAuth: true,
  },
  {
    title: "복습 일정",
    description: "현재는 화면만 잡고 실제 일정 계약은 추후 연결합니다.",
    href: "/mypage",
    requiresAuth: true,
  },
  {
    title: "관전",
    description: "진행 중인 방 목록과 관전 상세 화면으로 이동합니다.",
    href: "/spectate",
    requiresAuth: true,
  },
];

export function getQueueCategoryLabel(category: string | null) {
  if (!category) {
    return "-";
  }

  return queueCategories.find((item) => item.value === category)?.label ?? category;
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
