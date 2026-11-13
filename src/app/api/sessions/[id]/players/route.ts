import { NextResponse } from "next/server";
import { findPerson } from "@/lib/people";
import { addPlayer, getSession } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (session.status === "ended") {
    return NextResponse.json(
      { error: "This session has already finished." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const name = body?.name;
  const department = body?.department;
  if (typeof name !== "string" || typeof department !== "string") {
    return NextResponse.json(
      { error: "Please type your name and tap your department." },
      { status: 400 },
    );
  }

  // A staff id is only trusted once we have found that person ourselves.
  const person =
    typeof body?.staffId === "string" && body.staffId
      ? await findPerson(body.staffId)
      : undefined;

  const result = addPlayer(id, name, department, person);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ player: result.player });
}
