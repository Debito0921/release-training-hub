import { NextResponse } from "next/server";
import { getModule, getSession, leaderboard, scoreFor } from "@/lib/store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playerId = new URL(request.url).searchParams.get("playerId") ?? "";

  const session = await getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  const module = await getModule(session.moduleId);
  if (!module) {
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }
  const player = session.players.find((p) => p.id === playerId);
  if (!player) {
    return NextResponse.json({ error: "Please join again." }, { status: 404 });
  }

  const included = module.questions.filter((q) => q.included);
  const myAnswers = session.answers.filter((a) => a.playerId === player.id);

  // Only send rounds the host has opened, and only reveal the right answer
  // once that round is closed.
  const rounds = module.rounds
    .filter((r) => session.openRounds.includes(r.index))
    .map((r) => {
      const closed = session.closedRounds.includes(r.index);
      return {
        index: r.index,
        featureName: r.featureName,
        closed,
        questions: r.questionIds
          .map((qid) => included.find((q) => q.id === qid))
          .filter((q): q is NonNullable<typeof q> => Boolean(q))
          .map((q) => {
            const mine = myAnswers.find((a) => a.questionId === q.id);
            return {
              id: q.id,
              stem: q.stem,
              options: q.options,
              myAnswer: mine ? mine.optionIndex : null,
              correctIndex: closed || mine ? q.correctIndex : null,
            };
          }),
      };
    })
    .sort((a, b) => a.index - b.index);

  const { answered, correct } = scoreFor(session, player.id);
  const board = leaderboard(session);

  return NextResponse.json({
    player,
    session: { id: session.id, code: session.code, status: session.status },
    module: {
      title: module.title,
      passMark: module.passMark,
      questionCount: included.length,
    },
    rounds,
    score: { answered, correct, total: included.length },
    rank: board.findIndex((p) => p.id === player.id) + 1,
    playerCount: board.length,
    leaderboard:
      session.status === "ended"
        ? board.slice(0, 10).map((p) => ({
            id: p.id,
            name: p.name,
            department: p.department,
            correct: p.correct,
          }))
        : [],
  });
}
