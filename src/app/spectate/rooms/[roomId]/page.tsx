import SpectateRoomScreen from "@/features/spectate-room/screen";

export default async function SpectateRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return <SpectateRoomScreen roomId={roomId} />;
}
