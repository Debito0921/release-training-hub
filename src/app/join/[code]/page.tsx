import { AppShell } from "@/components/app-shell";
import { PickName } from "./pick-name";

export default async function JoinWithCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <AppShell>
      <PickName code={code} />
    </AppShell>
  );
}
