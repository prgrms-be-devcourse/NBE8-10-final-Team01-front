import BattleRoomScreen from "@/features/battle-room/screen";

export default async function BattleRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return <BattleRoomScreen roomId={roomId} />;
}
