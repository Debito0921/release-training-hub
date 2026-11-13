import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { LoginForm } from "./login-form";

export default function HostLoginPage() {
  return (
    <AppShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}
