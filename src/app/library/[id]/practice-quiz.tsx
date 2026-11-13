"use client";

// Practice on your own, with no host and no live room. Nothing is saved: these
// scores must not mix with the workshop numbers on the results dashboard.

import { useState } from "react";
import { Check, RotateCcw, Trophy, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Question } from "@/lib/types";

type PracticeQuestion = Pick<
  Question,
  "id" | "featureName" | "stem" | "options" | "correctIndex"
>;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function PracticeQuiz({
  questions,
  passMark,
}: {
  questions: PracticeQuestion[];
  passMark: number;
}) {
  const [order, setOrder] = useState(() => shuffle(questions));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const question = order[index];
  const total = order.length;

  function pick(option: number) {
    if (picked !== null) return;
    setPicked(option);
    if (option === question.correctIndex) setCorrect(correct + 1);
  }

  function next() {
    if (index + 1 >= total) {
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
  }

  function restart() {
    setOrder(shuffle(questions));
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setDone(false);
  }

  if (done) {
    const score = Math.round((correct / total) * 100);
    const passed = score >= passMark;
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="font-[family-name:var(--font-display)] text-4xl font-extrabold">
            {score}%
          </p>
          <Badge className="mt-3" variant={passed ? "default" : "destructive"}>
            {passed ? "Passed" : `Below the ${passMark}% pass mark`}
          </Badge>
          <p className="mt-3 text-sm text-muted-foreground">
            {correct} of {total} right
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            Practice runs are just for you. They are not counted in the
            workshop results.
          </p>
          <Button
            size="lg"
            className="mt-5 h-11 w-full text-base sm:w-auto"
            onClick={restart}
          >
            <RotateCcw className="size-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline">
            Question {index + 1} of {total}
          </Badge>
          <Badge>
            <Trophy className="size-3" />
            {correct} right
          </Badge>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + (picked !== null ? 1 : 0)) / total) * 100}%` }}
          />
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {question.featureName}
          </p>
          <p className="mt-1.5 text-sm font-medium">{question.stem}</p>
        </div>

        <div className="space-y-2">
          {question.options.map((opt, i) => {
            const isCorrect = i === question.correctIndex;
            const mine = picked === i;

            let tone = "border-border bg-card hover:border-primary hover:bg-accent";
            if (picked !== null && isCorrect) {
              tone = "border-[var(--success)] bg-[var(--success)]/10";
            } else if (mine) {
              tone = "border-destructive bg-destructive/10";
            }

            return (
              <button
                key={i}
                type="button"
                disabled={picked !== null}
                onClick={() => pick(i)}
                className={`flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors disabled:cursor-default ${tone}`}
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold text-secondary-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1">{opt}</span>
                {picked !== null && isCorrect ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                ) : mine ? (
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : null}
              </button>
            );
          })}
        </div>

        {picked !== null ? (
          <Button
            size="lg"
            className="h-11 w-full text-base"
            onClick={next}
          >
            {index + 1 >= total ? "See my score" : "Next question"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
