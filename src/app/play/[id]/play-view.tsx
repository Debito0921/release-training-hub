"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, Crown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PlayQuestion = {
  id: string;
  stem: string;
  options: string[];
  myAnswer: number | null;
  correctIndex: number | null;
};

type PlayRound = {
  index: number;
  featureName: string;
  closed: boolean;
  questions: PlayQuestion[];
};

type State = {
  player: { id: string; name: string; department: string };
  session: { id: string; code: string; status: "lobby" | "live" | "ended" };
  module: { title: string; passMark: number; questionCount: number };
  rounds: PlayRound[];
  score: { answered: number; correct: number; total: number };
  rank: number;
  playerCount: number;
  leaderboard: { id: string; name: string; department: string; correct: number }[];
};

/** The white panel look the whole player screen is built from. */
const PANEL = "rounded-2xl bg-card shadow-[var(--shadow-soft)]";

/** How far through the questions this player is, drawn as a ring. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const part = total ? Math.min(done / total, 1) : 0;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-secondary"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - part)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-[family-name:var(--font-display)] text-lg font-bold">
          {done}
        </span>
        <span className="mt-0.5 text-[10px] text-muted-foreground">
          of {total}
        </span>
      </div>
    </div>
  );
}

export function PlayView({ sessionId }: { sessionId: string }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(window.localStorage.getItem(`player:${sessionId}`));
  }, [sessionId]);

  const load = useCallback(async () => {
    if (!playerId) return;
    const res = await fetch(
      `/api/sessions/${sessionId}/play?playerId=${encodeURIComponent(playerId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      setError("We lost your place in the quiz. Please scan the QR code again.");
      return;
    }
    setState(await res.json());
  }, [playerId, sessionId]);

  useEffect(() => {
    if (!playerId) return;
    void load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [load, playerId]);

  async function answer(questionId: string, optionIndex: number) {
    if (!playerId) return;
    setSending(questionId);
    const res = await fetch(`/api/sessions/${sessionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, questionId, optionIndex }),
    });
    setSending(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "That answer did not save.");
    }
    await load();
  }

  if (!playerId || error) {
    return (
      <Card className="mx-auto max-w-sm">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {error ?? "Please join the quiz first."}
          </p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/join" />}>
            Join a quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!state) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { player, session, module, rounds, score } = state;
  const scorePct = score.total
    ? Math.round((score.correct / score.total) * 100)
    : 0;
  const passed = scorePct >= module.passMark;
  const wrong = score.answered - score.correct;
  const top3 = state.leaderboard.slice(0, 3);
  const rest = state.leaderboard.slice(3);
  /** Second, first, third, so the winner stands in the middle. */
  const podiumOrder = [1, 0, 2];
  const podiumHeight = ["h-20", "h-14", "h-11"];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Where am I up to */}
      <div className={`sticky top-14 z-20 p-4 ${PANEL}`}>
        <div className="flex items-center gap-4">
          <ProgressRing done={score.answered} total={score.total} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-display)] text-base font-bold">
              {player.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {player.department} · answered so far
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                <Check className="size-3.5" />
                {score.correct}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                <X className="size-3.5" />
                {wrong}
              </span>
            </div>
          </div>
        </div>
      </div>

      {session.status === "ended" ? (
        <div className="rounded-2xl bg-primary p-7 text-center text-primary-foreground shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium uppercase tracking-wide opacity-70">
            Your score
          </p>
          <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold leading-none">
            {scorePct}%
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {passed ? "Passed" : `Below the ${module.passMark}% pass mark`}
          </p>
          <p className="mt-3 text-sm opacity-85">
            {score.correct} of {score.total} right · rank {state.rank} of{" "}
            {state.playerCount}
          </p>
          {!passed ? (
            <p className="mx-auto mt-2 max-w-xs text-sm opacity-85">
              You can practise this release again any time from the library.
            </p>
          ) : null}
        </div>
      ) : null}

      {session.status === "ended" && state.leaderboard.length > 0 ? (
        <div className={`p-5 ${PANEL}`}>
          <p className="mb-4 text-center font-[family-name:var(--font-display)] text-base font-bold">
            Top scores
          </p>
          <div className="flex items-end justify-center gap-2">
            {podiumOrder.map((place) => {
              const p = top3[place];
              if (!p) return null;
              return (
                <div key={p.id} className="flex w-1/3 flex-col items-center">
                  {place === 0 ? (
                    <Crown className="mb-1 size-5 text-primary" />
                  ) : null}
                  <p className="w-full truncate text-center text-xs font-semibold">
                    {p.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.correct} right
                  </p>
                  <div
                    className={`mt-1.5 flex w-full items-start justify-center rounded-t-xl pt-2 ${
                      podiumHeight[place]
                    } ${
                      p.id === player.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    <span className="font-[family-name:var(--font-display)] text-lg font-bold">
                      {place + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {rest.length > 0 ? (
            <ol className="mt-4 space-y-1">
              {rest.map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                    p.id === player.id ? "bg-accent" : "odd:bg-muted"
                  }`}
                >
                  <span className="w-5 text-muted-foreground">{i + 4}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.department}
                  </span>
                  <span className="font-semibold">{p.correct}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}

      {rounds.length === 0 ? (
        <div className={`px-6 py-14 text-center ${PANEL}`}>
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-accent">
            <Clock className="size-5 text-primary" />
          </span>
          <p className="font-[family-name:var(--font-display)] text-lg font-bold">
            You are in
          </p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
            Wait for the host to open the first round. The questions will appear
            here by themselves.
          </p>
        </div>
      ) : null}

      {rounds.map((round) => (
        <div key={round.index} className={`p-5 ${PANEL}`}>
          <div className="mb-4">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                round.closed
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              Round {round.index + 1}
            </span>
            <p className="mt-2 font-[family-name:var(--font-display)] text-lg font-bold leading-snug">
              {round.featureName}
            </p>
            {round.closed ? (
              <p className="mt-1 text-xs text-muted-foreground">
                This round is closed. The right answers are shown below.
              </p>
            ) : null}
          </div>

          <div className="space-y-7">
            {round.questions.map((q, qi) => {
              const locked = q.myAnswer !== null || round.closed;
              return (
                <div key={q.id}>
                  <p className="mb-3 text-[0.95rem] font-semibold leading-snug">
                    <span className="mr-1.5 text-muted-foreground">
                      {qi + 1}.
                    </span>
                    {q.stem}
                  </p>
                  <div className="space-y-2.5">
                    {q.options.map((opt, i) => {
                      const mine = q.myAnswer === i;
                      const isCorrect =
                        q.correctIndex !== null && i === q.correctIndex;
                      const showWrong = mine && q.correctIndex !== null && !isCorrect;

                      // Tiles stay plain while the round is open, so nobody can
                      // read the answer off the colours.
                      let tile = locked
                        ? "border-border bg-card"
                        : "border-border bg-card hover:border-primary hover:bg-accent";
                      let letter = "bg-muted text-muted-foreground";
                      if (q.correctIndex !== null && isCorrect) {
                        tile = "border-success bg-success/10";
                        letter = "bg-success text-white";
                      } else if (showWrong) {
                        tile = "border-destructive bg-destructive/10";
                        letter = "bg-destructive text-white";
                      } else if (mine) {
                        tile = "border-primary bg-accent";
                        letter = "bg-primary text-primary-foreground";
                      }

                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={locked || sending === q.id}
                          onClick={() => answer(q.id, i)}
                          className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left text-sm font-medium transition-colors disabled:cursor-default ${tile}`}
                        >
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${letter}`}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="min-w-0 flex-1">{opt}</span>
                          {q.correctIndex !== null && isCorrect ? (
                            <Check className="size-4 shrink-0 text-success" />
                          ) : showWrong ? (
                            <X className="size-4 shrink-0 text-destructive" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
