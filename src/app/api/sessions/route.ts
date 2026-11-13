import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { createSession, getModule } from "@/lib/store";

export async function POST(request: Request) {
  // The room is saved against whoever is running it, so a host only ever sees
  // their own rooms in the results.
  const account = await getAccount();
  if (!account) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const moduleId = body?.moduleId;
  const module =
    typeof moduleId === "string" ? await getModule(moduleId) : undefined;
  if (!module) {
    return NextResponse.json({ error: "Module not found." }, { status: 400 });
  }
  if (module.status === "draft") {
    return NextResponse.json(
      { error: "Save this release to the library before you host it." },
      { status: 400 },
    );
  }
  const session = await createSession(moduleId, account.id);
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 400 });
  }
  return NextResponse.json({ session });
}
