import { AppShell, PageTitle } from "@/components/app-shell";
import { ResultsView } from "./results-view";

export default function DashboardPage() {
  return (
    <AppShell>
      <PageTitle
        title="Results"
        description="First-attempt pass rate is the official number. Retakes still count for learning, but they are not in these figures."
      />
      <ResultsView />
    </AppShell>
  );
}
