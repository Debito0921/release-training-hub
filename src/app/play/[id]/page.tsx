import { AppShell } from "@/components/app-shell";
import { PlayView } from "./play-view";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <PlayView sessionId={id} />
    </AppShell>
  );
}
