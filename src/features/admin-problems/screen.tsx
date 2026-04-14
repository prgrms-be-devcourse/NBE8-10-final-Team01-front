"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

import type {
  AdminProblemBulkImportResponse,
  AdminProblemBulkRequest,
  AdminProblemSingleValidateResponse,
  AdminProblemBulkValidateResponse,
  AdminProblemMutationResponse,
  AdminProblemUpsertRequest,
} from "@/shared/api/contracts";
import { useAppSession } from "@/features/layout/session-context";

const SINGLE_TEMPLATE_OBJECT: AdminProblemUpsertRequest = {
  title: "누적합 최대 구간",
  difficulty: "EASY",
  content:
    "길이가 N인 수열에서 연속 부분합의 최댓값을 구하시오. 수열 원소는 음수, 0, 양수를 모두 포함할 수 있다.",
  difficultyRating: 800,
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  checkerCode: null,
  inputFormat:
    "첫 줄에 N, 둘째 줄에 N개의 정수 수열이 공백으로 주어진다. (음수 포함 가능)",
  outputFormat: "최대 부분합을 출력한다.",
  tags: ["동적계획법", "누적합"],
  sampleCases: [
    { input: "5\\n1 -2 3 4 -1", output: "7" },
    { input: "4\\n-1 -2 -3 -4", output: "-1" },
    { input: "3\\n2 2 2", output: "6" },
  ],
  hiddenCases: [
    { input: "1\\n100", output: "100" },
    { input: "1\\n-100", output: "-100" },
    { input: "6\\n1 2 -10 3 4 5", output: "12" },
    { input: "7\\n-2 1 -3 4 -1 2 1", output: "6" },
    { input: "5\\n0 0 0 0 0", output: "0" },
    { input: "4\\n100 -1 -1 -1", output: "100" },
    { input: "4\\n-1 100 -1 -1", output: "100" },
    { input: "4\\n-1 -1 100 -1", output: "100" },
    { input: "4\\n-1 -1 -1 100", output: "100" },
    { input: "8\\n1 -1 1 -1 1 -1 1 -1", output: "1" },
  ],
};

const SINGLE_TEMPLATE_JSON = JSON.stringify(SINGLE_TEMPLATE_OBJECT, null, 2);
const BULK_TEMPLATE_JSON = JSON.stringify(
  { problems: [SINGLE_TEMPLATE_OBJECT] },
  null,
  2,
);

function readErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const map = payload as Record<string, unknown>;
  if (typeof map.message === "string") {
    return map.message;
  }
  if (typeof map.msg === "string") {
    return map.msg;
  }
  return fallback;
}

function parseSinglePayload(raw: string): AdminProblemUpsertRequest {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("단건 요청은 JSON 객체여야 합니다.");
    }
    return parsed as AdminProblemUpsertRequest;
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON 파싱 실패";
    throw new Error(`단건 JSON 파싱 실패: ${message}`);
  }
}

function parseBulkPayload(raw: string): AdminProblemBulkRequest {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("대량 요청은 JSON 객체여야 합니다.");
    }

    const candidate = parsed as { problems?: unknown };
    if (!Array.isArray(candidate.problems)) {
      throw new Error("problems는 배열이어야 합니다.");
    }

    return parsed as AdminProblemBulkRequest;
  } catch (error) {
    const message = error instanceof Error ? error.message : "JSON 파싱 실패";
    throw new Error(`대량 JSON 파싱 실패: ${message}`);
  }
}

function buildBulkValidationFingerprint(payload: AdminProblemBulkRequest): string {
  return JSON.stringify({ problems: payload.problems });
}

async function readJsonFromFile(file: File): Promise<string> {
  return file.text();
}

export default function AdminProblemsScreen() {
  const { session, sessionLoaded } = useAppSession();
  const isAdmin = session.member?.role === "ROLE_ADMIN";
  const [manageMode, setManageMode] = useState<"single" | "bulk">("single");

  const [singleJson, setSingleJson] = useState(SINGLE_TEMPLATE_JSON);
  const [bulkJson, setBulkJson] = useState(BULK_TEMPLATE_JSON);
  const [problemIdForUpdate, setProblemIdForUpdate] = useState("");

  const [singleResultMessage, setSingleResultMessage] = useState<string | null>(
    null,
  );
  const [singleErrorMessage, setSingleErrorMessage] = useState<string | null>(
    null,
  );
  const [singleValidateResult, setSingleValidateResult] =
    useState<AdminProblemSingleValidateResponse | null>(null);
  const [bulkResultMessage, setBulkResultMessage] = useState<string | null>(
    null,
  );
  const [bulkErrorMessage, setBulkErrorMessage] = useState<string | null>(null);
  const [bulkValidateResult, setBulkValidateResult] =
    useState<AdminProblemBulkValidateResponse | null>(null);
  const [bulkValidationToken, setBulkValidationToken] = useState<string | null>(
    null,
  );
  const [bulkValidatedFingerprint, setBulkValidatedFingerprint] = useState<
    string | null
  >(null);

  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const bulkImportInFlightRef = useRef(false);

  const gateMessage = useMemo(() => {
    if (!sessionLoaded) {
      return "세션을 확인하는 중입니다.";
    }
    if (!session.authenticated) {
      return "로그인이 필요합니다.";
    }
    if (!isAdmin) {
      return "관리자 권한이 필요합니다.";
    }
    return null;
  }, [isAdmin, session.authenticated, sessionLoaded]);
  const isBulkImportReady = useMemo(() => {
    if (!bulkValidateResult || bulkValidateResult.errors.length > 0) {
      return false;
    }
    if (!bulkValidationToken || !bulkValidatedFingerprint) {
      return false;
    }
    try {
      const payload = parseBulkPayload(bulkJson);
      return (
        buildBulkValidationFingerprint(payload) === bulkValidatedFingerprint
      );
    } catch {
      return false;
    }
  }, [bulkJson, bulkValidateResult, bulkValidatedFingerprint, bulkValidationToken]);

  function resetBulkValidationGate() {
    setBulkValidationToken(null);
    setBulkValidatedFingerprint(null);
  }

  async function handleCreate() {
    setSingleResultMessage(null);
    setSingleErrorMessage(null);
    setSingleValidateResult(null);

    let payload: AdminProblemUpsertRequest;
    try {
      payload = parseSinglePayload(singleJson);
    } catch (error) {
      setSingleErrorMessage(
        error instanceof Error ? error.message : "요청 생성에 실패했습니다.",
      );
      return;
    }

    setIsSubmittingSingle(true);
    try {
      const response = await fetch("/api/admin/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setSingleErrorMessage(
          readErrorMessage(body, "문제 등록에 실패했습니다."),
        );
        return;
      }

      const data = body as AdminProblemMutationResponse;
      setSingleResultMessage(
        `등록 성공: problemId=${data.problemId}, mode=${data.mode}`,
      );
    } catch {
      setSingleErrorMessage("문제 등록 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmittingSingle(false);
    }
  }

  async function handleUpdate() {
    setSingleResultMessage(null);
    setSingleErrorMessage(null);
    setSingleValidateResult(null);

    const parsedId = Number(problemIdForUpdate);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setSingleErrorMessage("수정할 problemId를 올바르게 입력하세요.");
      return;
    }

    let payload: AdminProblemUpsertRequest;
    try {
      payload = parseSinglePayload(singleJson);
    } catch (error) {
      setSingleErrorMessage(
        error instanceof Error ? error.message : "요청 생성에 실패했습니다.",
      );
      return;
    }

    setIsSubmittingSingle(true);
    try {
      const response = await fetch(`/api/admin/problems/${parsedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setSingleErrorMessage(
          readErrorMessage(body, "문제 수정에 실패했습니다."),
        );
        return;
      }

      const data = body as AdminProblemMutationResponse;
      setSingleResultMessage(
        `수정 성공: problemId=${data.problemId}, mode=${data.mode}`,
      );
    } catch {
      setSingleErrorMessage("문제 수정 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmittingSingle(false);
    }
  }

  async function handleSingleFileUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await readJsonFromFile(file);
      setSingleJson(text);
      setSingleErrorMessage(null);
      setSingleValidateResult(null);
    } catch {
      setSingleErrorMessage("단건 JSON 파일을 읽지 못했습니다.");
    }
  }

  async function handleSingleValidate() {
    setSingleResultMessage(null);
    setSingleErrorMessage(null);
    setSingleValidateResult(null);

    let payload: AdminProblemUpsertRequest;
    try {
      payload = parseSinglePayload(singleJson);
    } catch (error) {
      setSingleErrorMessage(
        error instanceof Error ? error.message : "요청 생성에 실패했습니다.",
      );
      return;
    }

    setIsSubmittingSingle(true);
    try {
      const response = await fetch("/api/admin/problems/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        setSingleErrorMessage(
          readErrorMessage(body, "단건 검증에 실패했습니다."),
        );
        return;
      }

      const data = body as AdminProblemSingleValidateResponse;
      setSingleValidateResult(data);
      setSingleResultMessage(
        data.valid
          ? "단건 검증 통과"
          : `단건 검증 실패: errors=${data.errors.length}`,
      );
    } catch {
      setSingleErrorMessage("단건 검증 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmittingSingle(false);
    }
  }

  async function handleBulkValidate() {
    setBulkResultMessage(null);
    setBulkErrorMessage(null);
    setBulkValidateResult(null);
    resetBulkValidationGate();

    let payload: AdminProblemBulkRequest;
    try {
      payload = parseBulkPayload(bulkJson);
    } catch (error) {
      setBulkErrorMessage(
        error instanceof Error ? error.message : "요청 생성에 실패했습니다.",
      );
      return;
    }

    setIsSubmittingBulk(true);
    try {
      const response = await fetch("/api/admin/problems/bulk/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setBulkErrorMessage(
          readErrorMessage(body, "대량 검증 요청에 실패했습니다."),
        );
        return;
      }

      const data = body as AdminProblemBulkValidateResponse;
      setBulkValidateResult(data);
      const fingerprint = buildBulkValidationFingerprint(payload);
      const token =
        typeof data.validationToken === "string" && data.validationToken.length > 0
          ? data.validationToken
          : null;
      if (data.errors.length === 0 && token) {
        setBulkValidationToken(token);
        setBulkValidatedFingerprint(fingerprint);
      }
      setBulkResultMessage(
        `검증 완료: total=${data.total}, valid=${data.validCount}, errors=${data.errors.length}`,
      );
    } catch {
      setBulkErrorMessage("대량 검증 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmittingBulk(false);
    }
  }

  async function handleBulkImport() {
    if (bulkImportInFlightRef.current) {
      return;
    }

    setBulkResultMessage(null);
    setBulkErrorMessage(null);

    let payload: AdminProblemBulkRequest;
    try {
      payload = parseBulkPayload(bulkJson);
    } catch (error) {
      setBulkErrorMessage(
        error instanceof Error ? error.message : "요청 생성에 실패했습니다.",
      );
      return;
    }

    const currentFingerprint = buildBulkValidationFingerprint(payload);
    const canImport =
      bulkValidateResult !== null &&
      bulkValidateResult.errors.length === 0 &&
      bulkValidationToken !== null &&
      bulkValidatedFingerprint === currentFingerprint;
    if (!canImport) {
      setBulkErrorMessage(
        "현재 JSON으로 Validate를 먼저 통과해야 Import할 수 있습니다.",
      );
      return;
    }

    bulkImportInFlightRef.current = true;
    setIsSubmittingBulk(true);
    try {
      const importPayload: AdminProblemBulkRequest = {
        problems: payload.problems,
        validationToken: bulkValidationToken,
      };
      const response = await fetch("/api/admin/problems/bulk/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPayload),
      });
      const body = (await response.json().catch(() => null)) as unknown;

      if (response.status === 400) {
        if (
          body &&
          typeof body === "object" &&
          "total" in body &&
          "validCount" in body &&
          "errors" in body
        ) {
          const invalid = body as AdminProblemBulkValidateResponse;
          setBulkValidateResult(invalid);
          setBulkErrorMessage(
            `등록 전 검증 실패: total=${invalid.total}, valid=${invalid.validCount}, errors=${invalid.errors.length}`,
          );
        } else {
          setBulkErrorMessage(
            readErrorMessage(body, "대량 등록 요청에 실패했습니다."),
          );
        }
        resetBulkValidationGate();
        return;
      }

      if (!response.ok) {
        setBulkErrorMessage(
          readErrorMessage(body, "대량 등록 요청에 실패했습니다."),
        );
        return;
      }

      const data = body as AdminProblemBulkImportResponse;
      setBulkResultMessage(
        `대량 등록 성공: total=${data.total}, inserted=${data.inserted}, updated=${data.updated}`,
      );
      resetBulkValidationGate();
      setBulkValidateResult(null);
    } catch {
      setBulkErrorMessage("대량 등록 요청 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmittingBulk(false);
      bulkImportInFlightRef.current = false;
    }
  }

  async function handleBulkFileUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await readJsonFromFile(file);
      setBulkJson(text);
      setBulkErrorMessage(null);
      setBulkResultMessage(null);
      setBulkValidateResult(null);
      resetBulkValidationGate();
    } catch {
      setBulkErrorMessage("대량 JSON 파일을 읽지 못했습니다.");
    }
  }

  if (gateMessage) {
    return (
      <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-md border border-app-border bg-app-elevated p-5">
            <p className="text-sm text-app-secondary">{gateMessage}</p>
            <div className="mt-4 flex gap-2">
              {!session.authenticated ? (
                <Link
                  href="/login?next=/admin/problems"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-app-accent px-4 text-sm font-semibold text-white"
                >
                  로그인
                </Link>
              ) : (
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-app-border bg-app-base px-4 text-sm font-medium text-app-primary"
                >
                  홈으로
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-full min-h-0 flex-col border-b border-app-border/80 bg-app-base lg:border-b-0 lg:border-r">
      <div className="flex h-12 items-center border-b border-app-border/80 bg-app-base px-4">
        <h1 className="text-sm font-semibold text-app-primary">
          관리자 문제 업로드 (JSON)
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setManageMode("single")}
            className={
              manageMode === "single"
                ? "inline-flex h-9 items-center justify-center rounded-md bg-app-accent px-3 text-sm font-semibold text-white"
                : "inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary"
            }
          >
            단건 관리
          </button>
          <button
            type="button"
            onClick={() => setManageMode("bulk")}
            className={
              manageMode === "bulk"
                ? "inline-flex h-9 items-center justify-center rounded-md bg-app-accent px-3 text-sm font-semibold text-white"
                : "inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary"
            }
          >
            대량 관리
          </button>
        </div>

        {manageMode === "single" ? (
          <section className="rounded-md border border-app-border p-4">
            <h2 className="text-sm font-semibold text-app-primary">
              단건 JSON 등록 / 수정
            </h2>
            <p className="mt-1 text-xs text-app-dim">
              템플릿 JSON에서 필요한 값만 바꿔서 통째로 붙여넣거나, 파일(.json)
              업로드 후 바로 등록하세요.
              sourceProblemId/inputMode/judgeType/starterCodes는 생략 시
              자동값으로 처리됩니다.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSingleJson(SINGLE_TEMPLATE_JSON)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary"
              >
                단건 템플릿 불러오기
              </button>

              <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary">
                단건 JSON 파일 불러오기
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleSingleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              value={singleJson}
              onChange={(event) => setSingleJson(event.target.value)}
              className="mt-3 h-96 w-full rounded-md border border-app-border bg-app-base px-3 py-2 font-mono text-xs text-app-primary"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSingleValidate()}
                disabled={isSubmittingSingle}
                className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary disabled:opacity-60"
              >
                단건 검증
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={isSubmittingSingle}
                className="inline-flex h-9 items-center justify-center rounded-md bg-app-accent px-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                단건 등록
              </button>

              <input
                value={problemIdForUpdate}
                onChange={(event) => setProblemIdForUpdate(event.target.value)}
                placeholder="수정 problemId"
                className="h-9 w-36 rounded-md border border-app-border bg-app-base px-3 text-sm text-app-primary"
              />
              <button
                type="button"
                onClick={() => void handleUpdate()}
                disabled={isSubmittingSingle}
                className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary disabled:opacity-60"
              >
                단건 수정
              </button>
            </div>

            {singleResultMessage ? (
              <p className="mt-2 text-xs text-app-success">
                {singleResultMessage}
              </p>
            ) : null}
            {singleErrorMessage ? (
              <p className="mt-2 text-xs text-app-danger">
                {singleErrorMessage}
              </p>
            ) : null}
            {singleValidateResult && !singleValidateResult.valid ? (
              <div className="mt-3 rounded-md border border-app-border bg-app-elevated p-3 text-xs text-app-secondary">
                <p>errors={singleValidateResult.errors.length}</p>
                <div className="mt-2 max-h-40 overflow-auto rounded border border-app-border bg-app-base p-2 font-mono">
                  {singleValidateResult.errors.map((error, index) => (
                    <p key={`${error.field}-${index}`}>
                      {error.field}: {error.message}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {manageMode === "bulk" ? (
          <section className="rounded-md border border-app-border p-4">
            <h2 className="text-sm font-semibold text-app-primary">
              대량 JSON 검증 / 등록
            </h2>
            <p className="mt-1 text-xs text-app-dim">
              요청 형태는{" "}
              <span className="font-mono">{`{ "problems": [ ... ] }`}</span>{" "}
              입니다. validate 후 import를 권장합니다.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkJson(BULK_TEMPLATE_JSON);
                  setBulkResultMessage(null);
                  setBulkErrorMessage(null);
                  setBulkValidateResult(null);
                  resetBulkValidationGate();
                }}
                className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary"
              >
                대량 템플릿 불러오기
              </button>

              <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary">
                대량 JSON 파일 불러오기
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleBulkFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              value={bulkJson}
              onChange={(event) => {
                setBulkJson(event.target.value);
                setBulkValidateResult(null);
                setBulkResultMessage(null);
                setBulkErrorMessage(null);
                resetBulkValidationGate();
              }}
              className="mt-3 h-72 w-full rounded-md border border-app-border bg-app-base px-3 py-2 font-mono text-xs text-app-primary"
            />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void handleBulkValidate()}
                disabled={isSubmittingBulk}
                className="inline-flex h-9 items-center justify-center rounded-md border border-app-border bg-app-base px-3 text-sm font-medium text-app-primary disabled:opacity-60"
              >
                Validate
              </button>
              <button
                type="button"
                onClick={() => void handleBulkImport()}
                disabled={isSubmittingBulk || !isBulkImportReady}
                className="inline-flex h-9 items-center justify-center rounded-md bg-app-accent px-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                Import
              </button>
            </div>
            {!isBulkImportReady ? (
              <p className="mt-2 text-xs text-app-dim">
                Import는 현재 JSON으로 Validate를 통과한 뒤에만 가능합니다.
              </p>
            ) : null}

            {bulkResultMessage ? (
              <p className="mt-2 text-xs text-app-success">
                {bulkResultMessage}
              </p>
            ) : null}
            {bulkErrorMessage ? (
              <p className="mt-2 text-xs text-app-danger">{bulkErrorMessage}</p>
            ) : null}

            {bulkValidateResult ? (
              <div className="mt-3 rounded-md border border-app-border bg-app-elevated p-3 text-xs text-app-secondary">
                <p>
                  total={bulkValidateResult.total}, valid=
                  {bulkValidateResult.validCount}, errors=
                  {bulkValidateResult.errors.length}
                </p>
                {bulkValidateResult.errors.length > 0 ? (
                  <div className="mt-2 max-h-48 overflow-auto rounded border border-app-border bg-app-base p-2 font-mono">
                    {bulkValidateResult.errors.map((error, index) => (
                      <p key={`${error.index}-${error.field}-${index}`}>
                        [{error.index}] {error.field}: {error.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
