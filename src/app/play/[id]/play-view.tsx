"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, Loader2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Sticky score header */}
      <div className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{player.name}</p>
            <p className="text-xs text-muted-foreground">{player.department}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {score.answered}/{score.total} answered
            </Badge>
            <Badge>
              <Trophy className="size-3" />
              {score.correct} right
            </Badge>
          </div>
        </div>
      </div>

      {session.status === "ended" ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="font-[family-name:var(--font-display)] text-4xl font-extrabold">
              {scorePct}%
            </p>
            <Badge className="mt-3" variant={passed ? "default" : "destructive"}>
              {passed ? "Passed" : `Below the ${module.passMark}% pass mark`}
            </Badge>
            <p className="mt-3 text-sm text-muted-foreground">
              {score.correct} of {score.total} right · rank {state.rank} of{" "}
              {state.playerCount}
            </p>
            {!passed ? (
              <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
                You can practise this release again any time from the library.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {session.status === "ended" && state.leaderboard.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" />
              Top scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {state.leaderboard.map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${
                    p.id === player.id ? "bg-accent" : "odd:bg-muted/40"
                  }`}
                >
                  <span className="w-5 text-sm font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {p.name}
                  </span>
                  <Badge variant="outline">{p.department}</Badge>
                  <span className="text-sm font-semibold">{p.correct}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {rounds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-[family-name:var(--font-display)] text-base font-semibold">
              You are in
            </p>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
              Wait for the host to open the first round. The questions will
              appear here by themselves.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {rounds.map((round) => (
        <Card key={round.index}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant={round.closed ? "secondary" : "default"}>
                Round {round.index + 1}
              </Badge>
              <CardTitle className="text-base">{round.featureName}</CardTitle>
            </div>
            {round.closed ? (
              <p className="text-xs text-muted-foreground">
                This round is closed. The right answers are shown below.
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            {round.questions.map((q, qi) => {
              const locked = q.myAnswer !== null || round.closed;
              return (
                <div key={q.id}>
                  <p className="mb-2.5 text-sm font-medium">
                    <span className="mr-1.5 text-muted-foreground">
                      {qi + 1}.
                    </span>
                    {q.stem}
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt, i) => {
                      const mine = q.myAnswer === i;
                      const isCorrect =
                        q.correctIndex !== null && i === q.correctIndex;
                      const showWrong = mine && q.correctIndex !== null && !isCorrect;

                      let tone =
                        "border-border bg-card hover:border-primary hover:bg-accent";
                      if (q.correctIndex !== null && isCorrect) {
                        tone = "border-[var(--success)] bg-[var(--success)]/10";
                      } else if (showWrong) {
                        tone = "border-destructive bg-destructive/10";
                      } else if (mine) {
                        tone = "border-primary bg-accent";
                      }

                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={locked || sending === q.id}
                          onClick={() => answer(q.id, i)}
                          className={`flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors disabled:cursor-default ${tone}`}
                        >
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold text-secondary-foreground">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="min-w-0 flex-1">{opt}</span>
                          {q.correctIndex !== null && isCorrect ? (
                            <Check className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                          ) : showWrong ? (
                            <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
