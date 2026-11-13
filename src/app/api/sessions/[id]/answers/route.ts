import { NextResponse } from "next/server";
import { recordAnswer } from "@/lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { playerId, questionId, optionIndex } = body ?? {};

  if (
    typeof playerId !== "string" ||
    typeof questionId !== "string" ||
    typeof optionIndex !== "number"
  ) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const result = await recordAnswer(id, playerId, questionId, optionIndex);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
