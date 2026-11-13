import { AppShell } from "@/components/app-shell";
import { SIGNUP_DEPARTMENTS } from "@/lib/store";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <AppShell>
      <RegisterForm departments={SIGNUP_DEPARTMENTS} />
    </AppShell>
  );
}
