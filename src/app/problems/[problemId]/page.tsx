import ProblemSoloScreen from "@/features/problem-solo/screen";

export default async function ProblemSoloPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;

  return <ProblemSoloScreen problemId={problemId} />;
}
