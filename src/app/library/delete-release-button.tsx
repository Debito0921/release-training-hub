"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Throwing away an abandoned import is a normal part of the job, so the host
// does it from the library itself. It asks first, because the questions go too.
export function DeleteReleaseButton({
  moduleId,
  title,
  isDraft,
  className,
}: {
  moduleId: string;
  title: string;
  isDraft: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not delete it.");
        return;
      }
      setOpen(false);
      toast.success(isDraft ? "Draft deleted." : "Release deleted.");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
        {isDraft ? "Delete this draft" : "Delete this release"}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
          <DialogDescription>
            {isDraft
              ? "The draft and its questions are removed. You can always upload the file again."
              : "The release and all of its questions are removed. This cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>
            Keep it
          </DialogClose>
          <Button variant="destructive" onClick={remove} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
