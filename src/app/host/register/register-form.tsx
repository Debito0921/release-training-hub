"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm({ departments }: { departments: string[] }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready =
    fullName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 8 &&
    !!department;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/account/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password, department }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "Could not create the account.");
      return;
    }

    // A full load, so the menu is rebuilt with the new sign-in.
    window.location.replace(body.role === "player" ? "/library" : "/host");
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-4 text-primary" />
          Create an account
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Everyone starts as a player, which means the library and the quiz. An
          admin can switch you to host if you need to run sessions.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              autoFocus
              autoComplete="name"
              maxLength={60}
              className="h-11 text-base"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="h-11 text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              className="h-11 text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 8 letters or numbers.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Department</Label>
            <div className="grid grid-cols-2 gap-2">
              {departments.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepartment(d)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    department === d
                      ? "border-2 border-primary bg-accent"
                      : "hover:bg-secondary"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full text-base"
            disabled={!ready || busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have one?{" "}
            <Link href="/host/login" className="font-medium text-primary underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
