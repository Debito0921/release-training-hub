"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = code.trim().toUpperCase();
        if (clean) router.push(`/join/${clean}`);
      }}
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABC12"
        maxLength={8}
        autoCapitalize="characters"
        autoComplete="off"
        className="h-14 text-center font-[family-name:var(--font-display)] text-2xl font-bold tracking-[0.25em]"
      />
      <Button type="submit" size="lg" className="w-full" disabled={!code.trim()}>
        Continue
        <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
