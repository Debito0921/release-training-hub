"use client";

import { LogOut } from "lucide-react";

export function SignOut() {
  async function signOut() {
    await fetch("/api/account/logout", { method: "POST" });
    // Full load so every cached host page is dropped along with the cookie.
    window.location.replace("/");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-3"
    >
      <LogOut className="size-3.5" />
      Sign out
    </button>
  );
}
