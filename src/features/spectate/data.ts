export interface RoomListResponse {
  roomId: number;
  status: string;
  problemTitle: string;
  currentPlayers: number;
  maxPlayers: number;
}

export const roomList: RoomListResponse[] = [
  {
    roomId: 302,
    status: "PLAYING",
    problemTitle: "단방향 그래프 최단 탈출",
    currentPlayers: 4,
    maxPlayers: 4,
  },
  {
    roomId: 303,
    status: "PLAYING",
    problemTitle: "문자열 압축 검증",
    currentPlayers: 4,
    maxPlayers: 4,
  },
];
