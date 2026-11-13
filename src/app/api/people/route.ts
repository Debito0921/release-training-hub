import { NextResponse } from "next/server";
import { getAccount, type Role } from "@/lib/account";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["player", "host", "admin"];

export async function PATCH(request: Request) {
  const me = await getAccount();
  if (me?.role !== "admin") {
    return NextResponse.json(
      { error: "Only an admin can change what someone is allowed to do." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    role?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id : "";
  const role = ROLES.find((r) => r === body?.role);

  if (!id || !role) {
    return NextResponse.json({ error: "Please choose a person and a role." }, { status: 400 });
  }
  if (id === me.id && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot take away your own admin access." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Could not save that change." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
