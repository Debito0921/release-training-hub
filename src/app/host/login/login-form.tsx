"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/account/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "That email and password do not match.");
      return;
    }

    const next = params.get("next");
    const target =
      next && next.startsWith("/") ? next : body.role === "player" ? "/library" : "/host";
    // A full load, not router.replace: the client router has already cached
    // the "redirect to sign in" answer for this path.
    window.location.replace(target);
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="size-4 text-primary" />
          Sign in
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          For the product team. Staff taking the quiz just scan the QR code.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoFocus
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
              autoComplete="current-password"
              className="h-11 text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full text-base"
            disabled={busy || !email || !password}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign in
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <Link href="/host/register" className="font-medium text-primary underline">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
