"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Radio,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Question, ReleaseModule } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  behaviour: "New behaviour",
  whereToSee: "Where to see it",
  misconception: "Misconception",
  trueFalse: "True or false",
  stepOrder: "Full flow",
  firstStep: "First step",
  nextStep: "Next step",
  limit: "Limit",
  step: "Steps",
  mustKnow: "Must-know",
  custom: "Written by you",
};

type Draft = { stem: string; options: string[]; correctIndex: number };

export function QuestionEditor({ module }: { module: ReleaseModule }) {
  const router = useRouter();
  const [questions, setQuestions] = useState(module.questions);
  const [rounds, setRounds] = useState(module.rounds);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    stem: "",
    options: [],
    correctIndex: 0,
  });
  const [saving, setSaving] = useState(false);
  const [busy, startTransition] = useTransition();

  const activeCount = questions.filter((q) => q.included).length;

  function replace(updated: Question) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updated.id ? updated : q)),
    );
  }

  async function toggle(question: Question) {
    const included = !question.included;
    replace({ ...question, included });
    const res = await fetch(`/api/modules/${module.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, included }),
    });
    if (!res.ok) {
      replace(question);
      toast.error("Could not change that question. Please try again.");
    }
  }

  function startEdit(question: Question) {
    setEditingId(question.id);
    setDraft({
      stem: question.stem,
      options: [...question.options],
      correctIndex: question.correctIndex,
    });
  }

  async function saveEdit(question: Question) {
    setSaving(true);
    const res = await fetch(`/api/modules/${module.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, ...draft }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not save that question.");
      return;
    }
    replace(data.question);
    setEditingId(null);
    toast.success("Question saved.");
  }

  async function addQuestion(topic: string, next: Draft) {
    setSaving(true);
    const res = await fetch(`/api/modules/${module.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, ...next }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not save that question.");
      return false;
    }
    setQuestions(data.module.questions);
    setRounds(data.module.rounds);
    toast.success("Question added.");
    return true;
  }

  function publish() {
    startTransition(async () => {
      const res = await fetch(`/api/modules/${module.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready" }),
      });
      if (!res.ok) {
        toast.error("Could not save the template. Please try again.");
        return;
      }
      toast.success("Saved to the library. You can host it any time.");
      router.push("/library");
    });
  }

  function hostNow() {
    startTransition(async () => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: module.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not start the session.");
        return;
      }
      router.push(`/host/${data.session.id}`);
    });
  }

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
          Check the questions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each topic becomes one round. Reword anything that does not sound
          right, untick what you do not want to ask, add your own questions,
          then save it to the library. The right answer is only ever shown to
          you.
        </p>
      </div>

      {rounds.map((round) => (
        <Card key={round.index}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge>Round {round.index + 1}</Badge>
              <CardTitle className="text-base">{round.featureName}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {round.questionIds.map((qid, qIndex) => {
              const q = questions.find((x) => x.id === qid);
              if (!q) return null;

              if (editingId === q.id) {
                return (
                  <EditForm
                    key={q.id}
                    label={`Q${qIndex + 1}`}
                    draft={draft}
                    setDraft={setDraft}
                    saving={saving}
                    onCancel={() => setEditingId(null)}
                    onSave={() => void saveEdit(q)}
                  />
                );
              }

              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-4 transition-opacity ${
                    q.included ? "" : "opacity-45"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={q.included}
                      onChange={() => void toggle(q)}
                      className="mt-1 size-4 accent-[var(--primary)]"
                      aria-label="Include this question"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Q{qIndex + 1}
                        </span>
                        <Badge variant="outline">
                          {KIND_LABEL[q.kind] ?? q.kind}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">{q.stem}</p>
                      <ul className="mt-2.5 space-y-1.5">
                        {q.options.map((opt, i) => (
                          <li
                            key={i}
                            className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                              i === q.correctIndex
                                ? "bg-success/10 text-foreground"
                                : "bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            {i === q.correctIndex ? (
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                            ) : (
                              <span className="mt-0.5 size-4 shrink-0 text-center text-xs font-semibold">
                                {String.fromCharCode(65 + i)}
                              </span>
                            )}
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>
                      {q.warning ? (
                        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                          {q.warning}
                        </p>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => startEdit(q)}
                      >
                        <Pencil className="size-3.5" />
                        Edit this question
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {adding ? (
        <AddQuestionForm
          topics={rounds.map((r) => r.featureName)}
          saving={saving}
          onCancel={() => setAdding(false)}
          onSave={async (topic, next) => {
            const ok = await addQuestion(topic, next);
            if (ok) setAdding(false);
          }}
        />
      ) : (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {questions.length === 0
                ? "This release is empty. Write your first question to get started."
                : "Missing something the file did not cover?"}
            </p>
            <Button
              size="lg"
              variant={questions.length === 0 ? "default" : "outline"}
              className="mt-3 h-11 w-full text-base sm:w-auto"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-4" />
              Write a question
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Always reachable, so a long list never hides the save button. */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {activeCount} of {questions.length} questions will be asked
          </p>
          {module.status === "draft" ? (
            <Button
              size="lg"
              className="h-11 w-full text-base sm:w-auto"
              onClick={publish}
              disabled={busy || activeCount === 0}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save to the library
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-11 w-full text-base sm:w-auto"
              onClick={hostNow}
              disabled={busy || activeCount === 0}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Radio className="size-4" />
              )}
              Host a live session
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A question typed in by hand. The topic decides which round it is asked in,
 * so a release with no file at all still groups its questions sensibly.
 */
function AddQuestionForm({
  topics,
  saving,
  onCancel,
  onSave,
}: {
  topics: string[];
  saving: boolean;
  onCancel: () => void;
  onSave: (topic: string, draft: Draft) => void;
}) {
  const [topic, setTopic] = useState(topics[0] ?? "");
  const [draft, setDraft] = useState<Draft>({
    stem: "",
    options: ["", "", "", ""],
    correctIndex: 0,
  });

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Write a question</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="size-3.5" />
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <label
          htmlFor="topic"
          className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Topic — this becomes the round
        </label>
        <Input
          id="topic"
          placeholder="Leave approval"
          className="h-11 text-base"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        {topics.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <Button
                key={t}
                variant="outline"
                size="xs"
                onClick={() => setTopic(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          <EditForm
            label="New question"
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onCancel={onCancel}
            onSave={() => onSave(topic, draft)}
            hideHeader
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EditForm({
  label,
  draft,
  setDraft,
  saving,
  onCancel,
  onSave,
  hideHeader = false,
}: {
  label: string;
  draft: Draft;
  setDraft: (next: Draft) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  /** Set when the form already sits inside its own card with a cancel button. */
  hideHeader?: boolean;
}) {
  function setOption(index: number, value: string) {
    const options = draft.options.map((o, i) => (i === index ? value : o));
    setDraft({ ...draft, options });
  }

  function removeOption(index: number) {
    const options = draft.options.filter((_, i) => i !== index);
    const correctIndex =
      draft.correctIndex === index
        ? 0
        : draft.correctIndex > index
          ? draft.correctIndex - 1
          : draft.correctIndex;
    setDraft({ ...draft, options, correctIndex });
  }

  return (
    <div className={hideHeader ? "" : "rounded-xl border-2 border-primary p-4"}>
      {hideHeader ? null : (
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            {label}
          </span>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="size-3.5" />
            Cancel
          </Button>
        </div>
      )}

      <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        The question
      </label>
      <textarea
        value={draft.stem}
        onChange={(e) => setDraft({ ...draft, stem: e.target.value })}
        rows={3}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
      />

      <label className="mt-4 mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        The answers — tick the right one
      </label>
      <div className="space-y-2">
        {draft.options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={draft.correctIndex === i}
              onChange={() => setDraft({ ...draft, correctIndex: i })}
              className="size-4 shrink-0 accent-[var(--primary)]"
              aria-label={`Answer ${String.fromCharCode(65 + i)} is correct`}
            />
            <Input
              value={option}
              onChange={(e) => setOption(i, e.target.value)}
              className="h-9"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeOption(i)}
              disabled={draft.options.length <= 2}
              aria-label="Remove this answer"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft({ ...draft, options: [...draft.options, ""] })
          }
          disabled={draft.options.length >= 6}
        >
          <Plus className="size-3.5" />
          Add an answer
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Save this question
        </Button>
      </div>
    </div>
  );
}
