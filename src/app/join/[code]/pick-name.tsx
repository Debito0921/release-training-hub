"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Person = { id: string; name: string; department: string };

type Payload = {
  session: { id: string; code: string; status: string };
  module: { title: string };
  departments: string[];
  takenNames: string[];
  people: Person[];
};

export function PickName({ code }: { code: string }) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [me, setMe] = useState<Person | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/code/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "That code did not work.");
          return;
        }
        setData(body);
      })
      .catch(() => setError("We could not reach the quiz. Check the WiFi."));
  }, [code]);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (!data || !department) return;
    setJoining(true);
    const res = await fetch(`/api/sessions/${data.session.id}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, department, staffId: me?.id }),
    });
    const body = await res.json();
    setJoining(false);
    if (!res.ok) {
      toast.error(body.error ?? "Could not join.");
      return;
    }
    // Remember who this phone is, so a refresh does not lose the score.
    window.localStorage.setItem(`player:${data.session.id}`, body.player.id);
    router.push(`/play/${data.session.id}`);
  }

  if (error) {
    return (
      <Card className="mx-auto max-w-sm">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/join" />}>
            Try another code
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const trimmed = name.trim();
  const duplicate = data.takenNames.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase(),
  );
  const ready = trimmed.length >= 2 && trimmed.length <= 24 && !!department;

  // "Is this you?" — matching the typed name to the staff list is what keeps
  // one person's scores together across releases.
  const needle = trimmed.toLowerCase();
  const suggestions =
    me || needle.length < 2
      ? []
      : data.people
          .filter((p) => {
            const words = p.name.toLowerCase().split(" ");
            return (
              p.name.toLowerCase().includes(needle) ||
              words.some((w) => w.startsWith(needle))
            );
          })
          .slice(0, 4);

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 text-center">
        <Badge variant="secondary">{data.session.code}</Badge>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
          {data.module.title}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Pick a name and your department, then tap Join.
        </p>
      </div>

      <form onSubmit={join} className="space-y-5">
        <div>
          <label
            htmlFor="player-name"
            className="mb-2 block text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Your name
          </label>
          <Input
            id="player-name"
            autoFocus
            autoComplete="off"
            maxLength={24}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (me) setMe(null);
            }}
            placeholder="e.g. Aina"
            className="h-12 text-base"
          />
          {me ? (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/40 bg-accent/60 px-3 py-2">
              <UserCheck className="size-4 shrink-0 text-primary" />
              <p className="min-w-0 flex-1 text-sm">
                Marks will be kept under{" "}
                <span className="font-semibold">{me.name}</span>
              </p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setMe(null);
                  setName("");
                }}
              >
                Not me
              </Button>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="mt-2">
              <p className="mb-1.5 text-xs text-muted-foreground">
                Is this you? Tap your name so the host can track your progress.
              </p>
              <div className="space-y-1.5">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setMe(p);
                      setName(p.name);
                      setDepartment(p.department);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {p.name}
                    </span>
                    <Badge variant="outline">{p.department}</Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {duplicate ? (
            <p className="mt-1.5 text-sm text-destructive">
              Someone in this room already used that name. Add your surname.
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              This is the name the host sees on the screen.
            </p>
          )}
        </div>

        <div className={me ? "hidden" : undefined}>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Your department
          </p>
          <div className="grid grid-cols-2 gap-2">
            {data.departments.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setDepartment(dept)}
                className={
                  department === dept
                    ? "rounded-xl border-2 border-primary bg-accent px-3 py-3 text-sm font-semibold text-accent-foreground"
                    : "rounded-xl border bg-card px-3 py-3 text-sm font-medium transition-colors hover:border-primary"
                }
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-base"
          disabled={!ready || duplicate || joining}
        >
          {joining ? <Loader2 className="size-4 animate-spin" /> : null}
          Join the quiz
        </Button>
      </form>
    </div>
  );
}
