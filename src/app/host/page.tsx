import { AppShell, PageTitle } from "@/components/app-shell";
import { HostUploader } from "./uploader";

export default function HostPage() {
  return (
    <AppShell>
      <PageTitle
        title="Host a release quiz"
        description="Upload the release notes you wrote for the workshop. Questions are built from the file straight away, you review them, then you start the live session."
      />
      <HostUploader />
    </AppShell>
  );
}
