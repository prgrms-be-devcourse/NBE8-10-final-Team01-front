"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import type {
  ApiErrorResponse,
  JoinRoomResponse,
  ProblemDetailResponse,
  RoomResponse,
  SessionResponse,
  SubmissionResponse,
} from "@/shared/api/contracts";
import {
  ApiCallout,
  DefinitionGrid,
  EventTimeline,
  MathText,
  MetricCard,
  MetricGrid,
  PageHero,
  Panel,
  StatusPill,
} from "@/shared/ui";
import { formatDateTime } from "@/shared/utils/format-date-time";

import {
  getBattleRoom,
  getBattleRoomEvents,
  getProblemDetail,
  latestSubmission as fallbackSubmission,
  submitTemplate,
} from "./data";

const BattleCodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[26rem] items-center justify-center rounded-2xl border border-zinc-300 bg-zinc-950 text-sm text-zinc-300">
      에디터를 준비하는 중입니다.
    </div>
  ),
});

function participantTone(status: string) {
  if (status === "PLAYING" || status === "EXIT") {
    return "success" as const;
  }

  return "default" as const;
}

async function readSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });

  if (!response.ok) {
    return {
      authenticated: false,
      member: null,
    } satisfies SessionResponse;
  }

  return (await response.json()) as SessionResponse;
}

export default function BattleRoomScreen({ roomId }: { roomId: string }) {
  const [session, setSession] = useState<SessionResponse>({
    authenticated: false,
    member: null,
  });
  const [room, setRoom] = useState<RoomResponse | null>(null);
  const [problem, setProblem] = useState<ProblemDetailResponse | null>(null);
  const [latestSubmission, setLatestSubmission] =
    useState<SubmissionResponse | null>(fallbackSubmission);
  const [code, setCode] = useState(submitTemplate.code);
  const [language, setLanguage] = useState(submitTemplate.language);
  const [testInput, setTestInput] = useState("");
  const [runNotice, setRunNotice] = useState<string | null>(null);
  const [message, setMessage] = useState("배틀룸 정보를 불러오는 중입니다.");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"api" | "fallback">("api");
  const hasAttemptedJoinRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void (async () => {
      const nextSession = await readSession();
      setSession(nextSession);

      if (!nextSession.authenticated) {
        setMessage("배틀룸은 로그인 후 접근할 수 있습니다.");
        return;
      }

      const roomResponse = await fetch(`/api/battle/rooms/${roomId}`, {
        cache: "no-store",
      });

      if (!roomResponse.ok) {
        const fallbackRoom = getBattleRoom(roomId);

        if (fallbackRoom) {
          setSource("fallback");
          setRoom(fallbackRoom);
          setProblem(getProblemDetail(fallbackRoom.problemId));
          setMessage("백엔드 연결 실패로 샘플 배틀룸을 표시합니다.");
          return;
        }

        const payload = (await roomResponse.json().catch(() => null)) as ApiErrorResponse | null;
        setError(payload?.message ?? "배틀룸을 불러오지 못했습니다.");
        return;
      }

      const nextRoom = (await roomResponse.json()) as RoomResponse;
      setRoom(nextRoom);
      setSource("api");

      const problemResponse = await fetch(`/api/problems/${nextRoom.problemId}`, {
        cache: "no-store",
      });

      if (problemResponse.ok) {
        setProblem((await problemResponse.json()) as ProblemDetailResponse);
        setMessage("실제 API 기반 배틀룸을 표시합니다.");
      } else {
        setProblem(getProblemDetail(nextRoom.problemId));
        setMessage("문제 상세 조회에 실패해 샘플 설명을 함께 표시합니다.");
      }
    })();
  }, [roomId]);

  useEffect(() => {
    if (
      hasAttemptedJoinRef.current ||
      !room ||
      !session.authenticated ||
      room.status !== "WAITING" ||
      !session.member
    ) {
      return;
    }

    const participant = room.participants.find(
      (item) => item.userId === session.member?.memberId,
    );

    if (participant?.status !== "READY") {
      return;
    }

    hasAttemptedJoinRef.current = true;

    startTransition(() => {
      void (async () => {
        const response = await fetch(`/api/battle/rooms/${roomId}/join`, {
          method: "POST",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
          setError(payload?.message ?? "배틀룸 입장에 실패했습니다.");
          return;
        }

        const payload = (await response.json()) as JoinRoomResponse;
        setMessage(`배틀룸 입장 처리 완료: ${payload.status}`);

        const refreshed = await fetch(`/api/battle/rooms/${roomId}`, {
          cache: "no-store",
        });

        if (refreshed.ok) {
          setRoom((await refreshed.json()) as RoomResponse);
        }
      })();
    });
  }, [room, roomId, session]);

  // WebSocket: BATTLE_STARTED 이벤트 수신 시 방 상태 자동 갱신
  useEffect(() => {
    if (!session.authenticated) return;

    const client = new Client({
      webSocketFactory: () => new SockJS("/ws"),
      reconnectDelay: 3000,
      onConnect: () => {
        client.subscribe(`/topic/room/${roomId}`, (message) => {
          let payload: unknown;
          try {
            payload = JSON.parse(message.body) as unknown;
          } catch {
            console.warn("[WS] 메시지 파싱 실패:", message.body);
            return;
          }

          if (
            typeof payload !== "object" ||
            payload === null ||
            !("type" in payload) ||
            (payload as { type: unknown }).type !== "BATTLE_STARTED"
          ) {
            return;
          }

          void fetch(`/api/battle/rooms/${roomId}`, { cache: "no-store" })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: RoomResponse | null) => {
              if (data) {
                setRoom(data);
                setMessage("배틀이 시작됐습니다!");
              }
            });
        });
      },
    });

    client.activate();
    return () => { void client.deactivate(); };
  }, [roomId, session.authenticated]);

  function handleSubmit() {
    if (!room) {
      return;
    }

    setError(null);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/submissions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            roomId: room.roomId,
            code,
            language,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
          setError(payload?.message ?? "제출에 실패했습니다.");
          return;
        }

        const payload = (await response.json()) as SubmissionResponse;
        setLatestSubmission(payload);
        setMessage(`제출 완료: ${payload.result ?? "채점 대기"}`);
      })();
    });
  }

  function handleRun() {
    setRunNotice(
      "현재 백엔드에는 Run 전용 API가 없습니다. 지금 제출 API는 즉시 채점/정산 흐름으로 이어지므로, 테스트 실행은 별도 endpoint가 추가된 뒤 연결해야 합니다.",
    );
  }

  if (!session.authenticated && !room) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Battle Room"
          title="로그인 후 배틀룸에 입장할 수 있습니다."
          description="배틀룸, 제출, 결과 조회는 모두 보호된 API 흐름입니다. 메인에서 로그인 후 큐를 잡고 배틀룸으로 이동하세요."
          actions={<StatusPill tone="warn">로그인 필요</StatusPill>}
        />

        <Panel title="이동" description="보호 화면 진입 전 처리">
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/battle/rooms/${roomId}`)}`}
              className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
            >
              로그인하러 가기
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
            >
              메인으로 돌아가기
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="space-y-8">
        <PageHero
          eyebrow="Battle Room"
          title="배틀룸을 열지 못했습니다."
          description="현재 roomId에 해당하는 방을 찾을 수 없습니다."
          actions={<StatusPill tone="danger">Load failed</StatusPill>}
        />
        <Panel title="오류" description="응답 메시지">
          <p className="text-sm leading-7 text-zinc-700">{error ?? message}</p>
        </Panel>
      </div>
    );
  }

  const events = getBattleRoomEvents(roomId);

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Battle Room"
        title={`Room ${room.roomId} / ${room.status}`}
        description="READY 상태 참여자는 화면 진입 시 자동으로 join 요청을 보냅니다. 문제 조회와 제출은 실제 API를 우선하고, 연결 실패 시에만 샘플 데이터를 보조로 사용합니다."
        actions={
          <>
            <StatusPill tone={room.status === "PLAYING" ? "success" : "warn"}>
              {room.status}
            </StatusPill>
            <StatusPill>problemId {room.problemId}</StatusPill>
            <StatusPill>{source === "api" ? "API" : "Fallback"}</StatusPill>
          </>
        }
      />

      <MetricGrid>
        <MetricCard label="Room ID" value={room.roomId} />
        <MetricCard label="Max Players" value={room.maxPlayers} />
        <MetricCard label="Participants" value={room.participants.length} />
        <MetricCard label="Timer End" value={formatDateTime(room.timerEnd)} />
      </MetricGrid>

      <div
        className={`rounded-2xl border px-4 py-3 text-sm ${
          error
            ? "border-rose-300 bg-rose-50 text-rose-900"
            : "border-zinc-300 bg-white text-zinc-700"
        }`}
      >
        {error ?? message}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel
          title="참가자 상태"
          description="`RoomResponse.participants`를 그대로 참가자 보드에 투영합니다."
        >
          <div className="space-y-3">
            {room.participants.map((participant) => (
              <div
                key={participant.userId}
                className="flex items-center justify-between rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-950">{participant.nickname}</p>
                  <p className="text-sm text-zinc-500">userId {participant.userId}</p>
                </div>
                <StatusPill tone={participantTone(participant.status)}>
                  {participant.status}
                </StatusPill>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="입장과 상태 변화"
          description="현재 백엔드는 READY 참여자가 모두 PLAYING이 되면 배틀을 시작합니다."
        >
          <ul className="space-y-3 text-sm leading-7 text-zinc-700">
            <li>메인에서 매칭 성사 메시지에 포함된 `roomId`를 읽어 이 화면으로 이동합니다.</li>
            <li>이 화면은 내 참여자 상태가 `READY`이면 자동으로 `join` 요청을 한 번 보냅니다.</li>
            <li>모든 참여자가 `PLAYING`으로 바뀌면 방 상태가 `PLAYING`이 되고 타이머가 시작됩니다.</li>
          </ul>
        </Panel>
      </div>

      {room.status === "WAITING" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel
            title="WAITING 상태"
            description="아직 전원이 입장하지 않았을 때는 참여자 상태 위주로 보여줍니다."
          >
            <ul className="space-y-3 text-sm leading-7 text-zinc-700">
              <li>문제는 이미 할당됐지만 실제 풀이 타이머는 아직 시작되지 않았을 수 있습니다.</li>
              <li>현재 사용자에게 `READY`가 보이면 자동 입장 요청이 한 번 전송됩니다.</li>
              <li>다른 참여자가 모두 들어오면 방 상태가 `PLAYING`으로 전환됩니다.</li>
            </ul>
          </Panel>

          <Panel title="대기 상태 API" description="현재 화면에서 실제로 붙는 엔드포인트">
            <div className="space-y-4">
              <ApiCallout
                method="GET"
                path={`/api/battle/rooms/${room.roomId}`}
                note="방 상태와 참여자 목록을 조회합니다."
              />
              <ApiCallout
                method="POST"
                path={`/api/battle/rooms/${room.roomId}/join`}
                note="현재 참여자를 READY에서 PLAYING으로 전환합니다."
              />
              <ApiCallout
                method="GET"
                path={`/api/problems/${room.problemId}`}
                note="문제 상세는 플레이 전에도 선조회할 수 있게 준비합니다."
              />
            </div>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Panel
              title="문제 상세"
              description="백엔드 `ProblemDetailResponse`를 문제 본문 섹션으로 사용합니다."
            >
              {problem ? (
                <div className="space-y-4">
                  <DefinitionGrid
                    items={[
                      { label: "title", value: problem.title },
                      { label: "difficulty", value: problem.difficulty },
                      { label: "timeLimitMs", value: problem.timeLimitMs },
                      { label: "memoryLimitMb", value: problem.memoryLimitMb },
                    ]}
                  />
                  <div className="space-y-4 rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Content
                      </p>
                      <p className="mt-2 text-sm leading-7 text-zinc-700">
                        <MathText>{problem.content}</MathText>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Input
                      </p>
                      <p className="mt-2 text-sm leading-7 text-zinc-700">
                        <MathText>{problem.inputFormat}</MathText>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Output
                      </p>
                      <p className="mt-2 text-sm leading-7 text-zinc-700">
                        <MathText>{problem.outputFormat}</MathText>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">문제 상세를 불러오지 못했습니다.</p>
              )}
            </Panel>

            <Panel
              title="실시간 이벤트 채널"
              description="현재 소켓 연결은 아직 붙이지 않았고, 채널 경로와 이벤트 의미를 먼저 고정합니다."
            >
              <EventTimeline events={events} />
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel
              title="코드 에디터"
              description="LeetCode처럼 Run과 Submit을 분리하되, 현재 실제 실행은 Submit만 연결되어 있습니다."
            >
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-zinc-700">언어</span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-500"
                  >
                    <option value="javascript">javascript</option>
                    <option value="java">java</option>
                    <option value="python">python</option>
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-medium text-zinc-700">코드</span>
                  <BattleCodeEditor
                    language={language}
                    value={code}
                    onChange={setCode}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleRun}
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:border-zinc-500"
                  >
                    Run
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-500"
                  >
                    {isPending ? "제출 중..." : "Submit"}
                  </button>
                </div>
              </div>
            </Panel>

            <Panel
              title="테스트 실행 패널"
              description="Run API가 생기면 이 영역에 케이스별 결과와 stdout/stderr를 붙입니다."
            >
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-zinc-700">사용자 입력</span>
                  <textarea
                    value={testInput}
                    onChange={(event) => setTestInput(event.target.value)}
                    rows={6}
                    placeholder="예: 4\n1 5 2 9"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 font-mono text-sm leading-6 text-zinc-900 outline-none transition focus:border-zinc-500"
                  />
                </label>

                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                  {runNotice ??
                    "현재는 Run 전용 백엔드가 없어서 실제 실행은 불가능합니다. 대신 입력 패널과 결과 영역 구조를 먼저 고정해뒀습니다."}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Stdout
                    </p>
                    <p className="mt-2 whitespace-pre-line font-mono text-sm leading-6 text-zinc-700">
                      Run API 미연동
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Expected
                    </p>
                    <p className="mt-2 whitespace-pre-line font-mono text-sm leading-6 text-zinc-700">
                      문제 상세 계약에 예제 입출력 필드가 없어 아직 표시하지 않습니다.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="최근 제출 응답" description="실제 제출 결과를 이 영역에 바로 표시합니다.">
              <DefinitionGrid
                items={[
                  { label: "submissionId", value: latestSubmission?.submissionId ?? "-" },
                  { label: "result", value: latestSubmission?.result ?? "-" },
                  { label: "passedCount", value: latestSubmission?.passedCount ?? "-" },
                  { label: "totalCount", value: latestSubmission?.totalCount ?? "-" },
                ]}
              />
            </Panel>

            <Panel title="연결 엔드포인트" description="플레이 중 방에서 붙는 API와 소켓 경로">
              <div className="space-y-4">
                <ApiCallout
                  method="GET"
                  path={`/api/problems/${room.problemId}`}
                  note="문제 상세를 단건으로 조회합니다."
                />
                <ApiCallout
                  method="POST"
                  path="/api/submissions"
                  note="프론트가 JWT subject를 memberId로 읽어 제출 본문을 완성합니다."
                />
                <ApiCallout
                  method="WS"
                  path={`/topic/room/${room.roomId}`}
                  note="배틀 시작, 제출, 참가자 종료, 정산 완료 이벤트를 수신할 경로입니다."
                />
              </div>
            </Panel>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/battle/results/${room.roomId}`}
                className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white"
              >
                결과 화면 보기
              </Link>
              <Link
                href="/"
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900"
              >
                메인으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
