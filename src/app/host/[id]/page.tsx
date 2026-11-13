import { AppShell } from "@/components/app-shell";
import { HostConsole } from "./console";

export default async function HostSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <HostConsole sessionId={id} />
    </AppShell>
  );
}
