export interface ParticipantInfo {
  userId: number;
  nickname: string;
  status: "READY" | "PLAYING" | "EXIT";
}

export interface SpectatorCodePanel {
  userId: number;
  nickname: string;
  lastUpdated: string;
  code: string;
}

export interface LiveEvent {
  timestamp: string;
  type: string;
  headline: string;
  detail: string;
}

export interface SpectateRoomFixture {
  roomId: number;
  problemTitle: string;
  topicPath: string;
  codeTopicPath: string;
  participants: ParticipantInfo[];
  codePanels: SpectatorCodePanel[];
  liveEvents: LiveEvent[];
}

export const spectateRoomsById: Record<number, SpectateRoomFixture> = {
  302: {
    roomId: 302,
    problemTitle: "단방향 그래프 최단 탈출",
    topicPath: "/topic/room/302",
    codeTopicPath: "/topic/room/302/spectate",
    participants: [
      { userId: 7, nickname: "algo_fox", status: "PLAYING" },
      { userId: 12, nickname: "graph_cat", status: "PLAYING" },
      { userId: 16, nickname: "dp_hawk", status: "PLAYING" },
      { userId: 19, nickname: "queue_bear", status: "PLAYING" },
    ],
    codePanels: [
      {
        userId: 7,
        nickname: "algo_fox",
        lastUpdated: "18:06:11",
        code: `const dist = Array(n + 1).fill(Infinity);\ndist[1] = 0;\nconst pq = [[0, 1]];\nwhile (pq.length) {\n  const [cost, node] = popMin(pq);\n  if (cost > dist[node]) continue;\n  for (const [next, weight] of graph[node]) {\n    const candidate = cost + weight;\n    if (candidate < dist[next]) {\n      dist[next] = candidate;\n      push(pq, [candidate, next]);\n    }\n  }\n}`,
      },
      {
        userId: 12,
        nickname: "graph_cat",
        lastUpdated: "18:08:40",
        code: `vector<long long> dist(n + 1, INF);\npriority_queue<Node, vector<Node>, greater<Node>> pq;\ndist[1] = 0;\npq.push({0, 1});\nwhile (!pq.empty()) {\n  auto [cost, cur] = pq.top();\n  pq.pop();\n  if (cost != dist[cur]) continue;\n  for (auto [next, weight] : graph[cur]) {\n    if (dist[next] > cost + weight) {\n      dist[next] = cost + weight;\n      pq.push({dist[next], next});\n    }\n  }\n}`,
      },
      {
        userId: 16,
        nickname: "dp_hawk",
        lastUpdated: "18:10:23",
        code: `def dijkstra(start):\n    dist = [INF] * (n + 1)\n    dist[start] = 0\n    heap = [(0, start)]\n    while heap:\n        cost, node = heapq.heappop(heap)\n        if cost > dist[node]:\n            continue\n        for nxt, weight in graph[node]:\n            nxt_cost = cost + weight\n            if nxt_cost < dist[nxt]:\n                dist[nxt] = nxt_cost\n                heapq.heappush(heap, (nxt_cost, nxt))\n    return dist`,
      },
      {
        userId: 19,
        nickname: "queue_bear",
        lastUpdated: "18:05:05",
        code: `function bfsFallback(start) {\n  const queue = [start];\n  const visited = Array(n + 1).fill(false);\n  visited[start] = true;\n  while (queue.length) {\n    const current = queue.shift();\n    for (const next of graph[current]) {\n      if (!visited[next]) {\n        visited[next] = true;\n        queue.push(next);\n      }\n    }\n  }\n}`,
      },
    ],
    liveEvents: [
      {
        timestamp: "18:00:00",
        type: "BATTLE_STARTED",
        headline: "배틀 시작",
        detail: "모든 참여자가 PLAYING 상태가 되며 30분 타이머가 시작됐다.",
      },
      {
        timestamp: "18:06:11",
        type: "CODE_UPDATE",
        headline: "관전자 코드 스트림",
        detail: "algo_fox가 다익스트라 구현을 관전자 채널로 전송했다.",
      },
      {
        timestamp: "18:08:44",
        type: "SUBMISSION",
        headline: "첫 제출",
        detail: "graph_cat가 AC를 받았고 passedCount 12/12가 브로드캐스트됐다.",
      },
      {
        timestamp: "18:09:03",
        type: "PARTICIPANT_DONE",
        headline: "완주 알림",
        detail: "graph_cat가 1등으로 종료됐다는 이벤트가 수신됐다.",
      },
      {
        timestamp: "18:19:20",
        type: "BATTLE_FINISHED",
        headline: "정산 완료",
        detail: "모든 참여자 상태를 기반으로 결과 정산이 끝났고 결과 화면으로 이동할 수 있다.",
      },
    ],
  },
  303: {
    roomId: 303,
    problemTitle: "문자열 압축 검증",
    topicPath: "/topic/room/303",
    codeTopicPath: "/topic/room/303/spectate",
    participants: [
      { userId: 21, nickname: "string_owl", status: "PLAYING" },
      { userId: 22, nickname: "scan_lark", status: "PLAYING" },
      { userId: 23, nickname: "regex_lynx", status: "PLAYING" },
      { userId: 24, nickname: "token_wolf", status: "PLAYING" },
    ],
    codePanels: [
      {
        userId: 21,
        nickname: "string_owl",
        lastUpdated: "18:03:01",
        code: `let answer = 0;\nfor (let i = 0; i < s.length; ) {\n  let count = 0;\n  while (i < s.length && s[i].match(/\\d/)) {\n    count = count * 10 + Number(s[i]);\n    i += 1;\n  }\n  if (count === 0 || i >= s.length) return "INVALID";\n  answer += count;\n  i += 1;\n}\nreturn String(answer);`,
      },
      {
        userId: 22,
        nickname: "scan_lark",
        lastUpdated: "18:04:19",
        code: `int i = 0;\nwhile (i < s.size()) {\n  int cnt = 0;\n  while (i < s.size() && isdigit(s[i])) {\n    cnt = cnt * 10 + (s[i] - '0');\n    i++;\n  }\n  if (cnt == 0 || i == s.size()) return invalid();\n  total += cnt;\n  i++;\n}`,
      },
      {
        userId: 23,
        nickname: "regex_lynx",
        lastUpdated: "18:04:47",
        code: `pattern = re.compile(r"(\\d+)([A-Za-z])")\nparts = pattern.findall(s)\nif ''.join(''.join(part) for part in parts) != s:\n    return 'INVALID'\nreturn str(sum(int(count) for count, _ in parts))`,
      },
      {
        userId: 24,
        nickname: "token_wolf",
        lastUpdated: "18:02:55",
        code: `tokens = tokenize(input)\nfor token in tokens:\n  if token.kind == "COUNT":\n    current = token.value\n  else:\n    restored += current\n`,
      },
    ],
    liveEvents: [
      {
        timestamp: "18:00:00",
        type: "BATTLE_STARTED",
        headline: "관전용 방 시작",
        detail: "문자열 압축 검증 배틀이 시작됐다.",
      },
      {
        timestamp: "18:07:32",
        type: "CODE_UPDATE",
        headline: "정규식 버전 업로드",
        detail: "regex_lynx가 CODE_UPDATE 메시지를 보냈다.",
      },
      {
        timestamp: "18:11:10",
        type: "SUBMISSION",
        headline: "두 번째 플레이어 AC",
        detail: "scan_lark가 8/8 통과 결과를 수신했다.",
      },
    ],
  },
};

export const sampleSpectateRoomIds = Object.keys(spectateRoomsById);

export function getSpectateRoom(roomId: string) {
  return spectateRoomsById[Number(roomId)] ?? null;
}
