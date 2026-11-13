"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Flag,
  Loader2,
  Lock,
  Trophy,
  Unlock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { QrCode } from "@/components/qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Round = {
  index: number;
  featureName: string;
  questionIds: string[];
};

type PerQuestion = {
  id: string;
  stem: string;
  featureName: string;
  options: string[];
  correctIndex: number;
  answered: number;
  correct: number;
  optionCounts: number[];
};

type State = {
  session: {
    id: string;
    code: string;
    status: "lobby" | "live" | "ended";
    openRounds: number[];
    closedRounds: number[];
    playerCount: number;
  };
  module: {
    id: string;
    title: string;
    goLive?: string;
    passMark: number;
    questionCount: number;
    rounds: Round[];
  };
  leaderboard: {
    id: string;
    name: string;
    department: string;
    answered: number;
    correct: number;
  }[];
  perQuestion: PerQuestion[];
};

export function HostConsole({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [lanOrigin, setLanOrigin] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("This session could not be found. Start a new one from Host.");
      return;
    }
    setState(await res.json());
  }, [sessionId]);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    fetch("/api/network", { cache: "no-store" })
      .then((r) => r.json())
      .then((n: { best: string | null; port: string }) => {
        if (n.best) setLanOrigin(`http://${n.best}:${n.port}`);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (state?.session.code) {
      const origin = lanOrigin ?? window.location.origin;
      setJoinUrl(`${origin}/join/${state.session.code}`);
    }
  }, [state?.session.code, lanOrigin]);

  async function act(body: Record<string, unknown>) {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "That did not work.");
      return;
    }
    await load();
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/host" />}>
            Back to Host
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

  const { session, module, leaderboard, perQuestion } = state;
  const ended = session.status === "ended";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
            {module.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={ended ? "secondary" : "default"}>
              {ended ? "Finished" : session.status === "live" ? "Live" : "Waiting to start"}
            </Badge>
            <Badge variant="outline">{module.questionCount} questions</Badge>
            <Badge variant="outline">Pass mark {module.passMark}%</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
            <BarChart3 className="size-4" />
            Results
          </Button>
          {!ended ? (
            <Button variant="destructive" onClick={() => act({ action: "end" })}>
              <Flag className="size-4" />
              End session
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Join panel */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Put this on the screen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {joinUrl ? <QrCode value={joinUrl} size={200} /> : null}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Or type the code at {joinUrl ? new URL(joinUrl).host : ""}/join
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-[0.2em]">
                {session.code}
              </p>
            </div>
            <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
              <Users className="size-4" />
              {session.playerCount} joined
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Rounds */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rounds</CardTitle>
              <p className="text-sm text-muted-foreground">
                Open a round when you finish talking about that feature. Close it
                when everyone has answered.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {module.rounds.map((round) => {
                const open = session.openRounds.includes(round.index);
                const closed = session.closedRounds.includes(round.index);
                const answers = perQuestion
                  .filter((q) => round.questionIds.includes(q.id))
                  .reduce((sum, q) => sum + q.answered, 0);
                const expected = round.questionIds.length * session.playerCount;

                return (
                  <div
                    key={round.index}
                    className="flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={open && !closed ? "default" : "secondary"}>
                          Round {round.index + 1}
                        </Badge>
                        <span className="truncate text-sm font-medium">
                          {round.featureName}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {round.questionIds.length} questions
                        {open
                          ? ` · ${answers} of ${expected} answers in`
                          : " · not opened yet"}
                        {closed ? " · closed" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {!open ? (
                        <Button
                          size="sm"
                          disabled={ended}
                          onClick={() => act({ action: "open", round: round.index })}
                        >
                          <Unlock className="size-3.5" />
                          Open
                        </Button>
                      ) : closed ? (
                        <Badge variant="secondary">
                          <Lock className="size-3" />
                          Closed
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => act({ action: "close", round: round.index })}
                        >
                          <Lock className="size-3.5" />
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Scoreboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="size-4 text-primary" />
                Scoreboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nobody has joined yet. Show the QR code on the screen.
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {leaderboard.map((p, i) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg px-2.5 py-2 odd:bg-muted/40"
                    >
                      <span className="w-5 text-sm font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {p.name}
                      </span>
                      <Badge variant="outline">{p.department}</Badge>
                      <span className="w-14 text-right text-sm font-semibold">
                        {p.correct}/{module.questionCount}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Per question breakdown */}
          {session.openRounds.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  What people are getting wrong
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Use this to decide what to go over again before you close the
                  workshop.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {perQuestion
                  .filter((q) => q.answered > 0)
                  .map((q) => {
                    const rate = Math.round((q.correct / q.answered) * 100);
                    return (
                      <div key={q.id} className="rounded-xl border p-3.5">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="text-sm font-medium">{q.stem}</p>
                          <Badge
                            variant={rate >= module.passMark ? "secondary" : "destructive"}
                          >
                            {rate}% right
                          </Badge>
                        </div>
                        <div className="space-y-1.5">
                          {q.options.map((opt, i) => {
                            const count = q.optionCounts[i];
                            const share = q.answered
                              ? Math.round((count / q.answered) * 100)
                              : 0;
                            const isCorrect = i === q.correctIndex;
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-md bg-muted/60">
                                  <div
                                    className={`absolute inset-y-0 left-0 ${
                                      isCorrect
                                        ? "bg-[var(--success)]/25"
                                        : "bg-destructive/15"
                                    }`}
                                    style={{ width: `${share}%` }}
                                  />
                                  <div className="relative flex h-full items-center gap-1.5 px-2.5">
                                    {isCorrect ? (
                                      <CheckCircle2 className="size-3.5 shrink-0 text-[var(--success)]" />
                                    ) : null}
                                    <span className="truncate text-xs">{opt}</span>
                                  </div>
                                </div>
                                <span className="w-10 text-right text-xs font-semibold text-muted-foreground">
                                  {count}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
