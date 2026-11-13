import { createAdminClient, createUserClient } from "./supabase/server";

export type Role = "player" | "host" | "admin";

export type Account = {
  id: string;
  email: string;
  fullName: string;
  department: string;
  role: Role;
};

// A host can upload releases and run sessions. An admin can do that and also
// change other people's roles.
export function canHost(role: Role | undefined) {
  return role === "host" || role === "admin";
}

export async function readRole(userId: string): Promise<Role> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  return (data?.role as Role) ?? "player";
}

// Null when nobody is signed in, which is the normal case for staff who
// scanned the QR code.
export async function getAccount(): Promise<Account | null> {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, department, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.email?.split("@")[0] ?? "Someone",
    department: profile?.department ?? "Product",
    role: (profile?.role as Role) ?? "player",
  };
}
