import { NextResponse } from "next/server";
import { SIGNUP_DEPARTMENTS } from "@/lib/store";
import { createAdminClient, createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The account is created with the service role key and marked as confirmed, so
// nobody has to wait for a confirmation email. Supabase's built-in mail is
// rate limited and internal staff would get stuck.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    fullName?: unknown;
    department?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName =
    typeof body?.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
  const department = SIGNUP_DEPARTMENTS.find((d) => d === body?.department);

  if (fullName.length < 2) {
    return NextResponse.json({ error: "Please type your full name." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please type a valid work email." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Please use a password with at least 8 letters or numbers." },
      { status: 400 },
    );
  }
  if (!department) {
    return NextResponse.json({ error: "Please tap your department." }, { status: 400 });
  }

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, department },
  });

  if (created.error) {
    const taken = /already|exists|registered/i.test(created.error.message);
    return NextResponse.json(
      {
        error: taken
          ? "That email already has an account. Sign in instead."
          : "Could not create the account. Please try again.",
      },
      { status: taken ? 409 : 500 },
    );
  }

  // Sign them in straight away, so registering lands them inside the app.
  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "Account created. Please sign in." }, { status: 200 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", created.data.user.id)
    .maybeSingle();

  return NextResponse.json({ ok: true, role: profile?.role ?? "player" });
}
