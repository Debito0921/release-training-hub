import { AppShell } from "@/components/app-shell";
import { CodeEntry } from "./code-entry";

export default function JoinPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-sm py-6">
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Join the quiz
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Scan the QR code on the screen, or type the code shown with it.
        </p>
        <CodeEntry />
      </div>
    </AppShell>
  );
}
