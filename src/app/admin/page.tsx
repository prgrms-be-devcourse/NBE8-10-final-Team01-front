import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
      <div className="flex h-12 items-center border-b border-app-border/80 bg-app-base px-4">
        <h1 className="text-sm font-semibold text-app-primary">관리자페이지</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <section className="rounded-md border border-app-border p-4">
          <h2 className="text-sm font-semibold text-app-primary">관리 메뉴</h2>
          <p className="mt-1 text-xs text-app-dim">
            아래 메뉴를 선택해서 관리자 기능으로 이동하세요.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/problems"
              className="rounded-md border border-app-border bg-app-elevated p-4 transition hover:border-app-accent/60 hover:bg-app-surface"
            >
              <p className="text-sm font-semibold text-app-primary">문제 관리</p>
              <p className="mt-1 text-xs text-app-secondary">
                단건/대량 JSON 검증 및 등록
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
