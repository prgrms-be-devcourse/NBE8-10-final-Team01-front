const ROLE_LABELS: Record<string, string> = {
  ROLE_USER: "일반사용자",
  ROLE_ADMIN: "관리자",
};

export function formatRoleLabel(role?: string | null) {
  if (!role) {
    return "로그인 필요";
  }

  return ROLE_LABELS[role] ?? role;
}
