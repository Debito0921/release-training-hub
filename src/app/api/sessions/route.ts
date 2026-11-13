import { NextResponse } from "next/server";
import { createSession, getModule } from "@/lib/store";

export async function POST(request: Request) {
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
  const session = createSession(moduleId);
  return NextResponse.json({ session });
}
