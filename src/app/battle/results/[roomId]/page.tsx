import BattleResultScreen from "@/features/battle-result/screen";

export default async function BattleResultPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return <BattleResultScreen roomId={roomId} />;
}
