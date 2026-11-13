import { NextResponse } from "next/server";
import {
  closeRound,
  endSession,
  getModule,
  getSession,
  leaderboard,
  openRound,
} from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  const module = await getModule(session.moduleId);
  if (!module) {
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }

  const included = module.questions.filter((q) => q.included);
  const rounds = module.rounds
    .map((r) => ({
      ...r,
      questionIds: r.questionIds.filter((qid) =>
        included.some((q) => q.id === qid),
      ),
    }))
    .filter((r) => r.questionIds.length > 0);

  const perQuestion = included.map((q) => {
    const answers = session.answers.filter((a) => a.questionId === q.id);
    return {
      id: q.id,
      stem: q.stem,
      featureName: q.featureName,
      kind: q.kind,
      options: q.options,
      correctIndex: q.correctIndex,
      answered: answers.length,
      correct: answers.filter((a) => a.correct).length,
      optionCounts: q.options.map(
        (_, i) => answers.filter((a) => a.optionIndex === i).length,
      ),
    };
  });

  return NextResponse.json({
    session: {
      id: session.id,
      code: session.code,
      status: session.status,
      openRounds: session.openRounds,
      closedRounds: session.closedRounds,
      playerCount: session.players.length,
    },
    module: {
      id: module.id,
      title: module.title,
      goLive: module.goLive,
      passMark: module.passMark,
      questionCount: included.length,
      rounds,
    },
    leaderboard: leaderboard(session),
    perQuestion,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === "open" && typeof body?.round === "number") {
    await openRound(id, body.round);
  } else if (action === "close" && typeof body?.round === "number") {
    await closeRound(id, body.round);
  } else if (action === "end") {
    await endSession(id);
  } else {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
