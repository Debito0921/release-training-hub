"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Lets a host run a release that is already in the library, instead of having
// to import the file again just to get a live session.
export function HostReleaseButton({
  moduleId,
  className,
  size = "sm",
  variant,
}: {
  moduleId: string;
  className?: string;
  size?: "sm" | "lg";
  variant?: "default" | "secondary";
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId }),
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
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={start}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Radio className="size-4" />
      )}
      Host a live session
    </Button>
  );
}
