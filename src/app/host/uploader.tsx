"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileUp, Loader2, PencilLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TemplateHelp } from "./template-help";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HostUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");

  async function submitMarkdown(markdown: string, label: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "We could not read that file.");
        setLoading(false);
        return;
      }
      toast.success(
        `${data.module.questions.length} questions built from ${label}.`,
      );
      // Nothing is playable yet: the host checks the questions, then saves.
      router.push(`/host/modules/${data.module.id}`);
    } catch {
      toast.error("Something went wrong reading that file.");
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      toast.error("Please use a markdown file (.md).");
      return;
    }
    const text = await file.text();
    await submitMarkdown(text, file.name);
  }

  async function startBlank(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const res = await fetch("/api/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not create the release.");
      setLoading(false);
      return;
    }
    router.push(`/host/modules/${data.module.id}`);
  }

  async function loadExample() {
    setLoading(true);
    const res = await fetch("/api/sample-release");
    const data = await res.json();
    await submitMarkdown(data.markdown, "the example release");
  }

  return (
    <div className="space-y-6">
      <Card
        className={dragging ? "border-primary bg-accent/40" : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        <CardContent className="py-10 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            {loading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <FileUp className="size-5" />
            )}
          </span>
          <p className="font-[family-name:var(--font-display)] text-base font-semibold">
            Drop the release notes here
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            A markdown file with one heading per feature. Questions are built
            straight away, then you check them before anyone plays.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button onClick={() => inputRef.current?.click()} disabled={loading}>
              <FileText className="size-4" />
              Choose a file
            </Button>
            <Button variant="outline" onClick={loadExample} disabled={loading}>
              <Sparkles className="size-4" />
              Try the example release
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <p className="font-[family-name:var(--font-display)] text-base font-semibold">
            No file? Write the questions yourself
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Start an empty release and type each question in. Nobody sees it
            until you save it to the library.
          </p>
          <form onSubmit={startBlank} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="release-title">Release name</Label>
              <Input
                id="release-title"
                placeholder="Dec 2026 — Leave Approval"
                className="h-11 text-base"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              variant="secondary"
              className="h-11 w-full text-base sm:w-auto"
              disabled={loading || title.trim().length < 3}
            >
              <PencilLine className="size-4" />
              Start writing
            </Button>
          </form>
        </CardContent>
      </Card>

      <TemplateHelp />
    </div>
  );
}
