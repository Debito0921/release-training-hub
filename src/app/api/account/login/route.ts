import { NextResponse } from "next/server";
import { readRole } from "@/lib/account";
import { createUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Please type your email and password." },
      { status: 400 },
    );
  }

  const supabase = await createUserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Slow brute force down a little without annoying a real person.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json(
      { error: "That email and password do not match." },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, role: await readRole(data.user.id) });
}
