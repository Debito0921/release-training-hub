import { AppShell, PageTitle } from "@/components/app-shell";
import { getAccount, type Role } from "@/lib/account";
import { createAdminClient } from "@/lib/supabase/server";
import { PeopleTable } from "./people-table";

export const dynamic = "force-dynamic";

export type Person = {
  id: string;
  fullName: string;
  department: string;
  role: Role;
  createdAt: string;
};

export default async function PeoplePage() {
  const me = await getAccount();
  const admin = createAdminClient();

  const { data } = await admin
    .from("profiles")
    .select("id, full_name, department, role, created_at")
    .order("created_at", { ascending: true });

  const people: Person[] = (data ?? []).map((row) => ({
    id: row.id as string,
    fullName: row.full_name as string,
    department: row.department as string,
    role: row.role as Role,
    createdAt: row.created_at as string,
  }));

  return (
    <AppShell>
      <PageTitle
        title="People"
        description="Everyone who registered. A player only sees the library and the quiz. A host can upload releases and run sessions. An admin can also change these roles."
      />
      <PeopleTable people={people} meId={me?.id ?? ""} />
    </AppShell>
  );
}
