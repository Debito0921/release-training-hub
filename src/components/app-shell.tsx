import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { canHost, getAccount } from "@/lib/account";
import { SignOut } from "./sign-out";

const NAV = [
  { href: "/host", label: "Host", need: "host" },
  { href: "/library", label: "Library", need: "anyone" },
  { href: "/dashboard", label: "Results", need: "host" },
  { href: "/host/people", label: "People", need: "admin" },
  { href: "/join", label: "Join", need: "anyone" },
] as const;

export async function AppShell({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  const isHost = canHost(account?.role);
  const isAdmin = account?.role === "admin";

  const nav = NAV.filter((item) =>
    item.need === "anyone" ? true : item.need === "admin" ? isAdmin : isHost,
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-4" />
            </span>
            <span className="font-[family-name:var(--font-display)] text-sm font-bold tracking-tight sm:text-base">
              Release Training Hub
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-3"
              >
                {item.label}
              </Link>
            ))}
            {account ? (
              <SignOut />
            ) : (
              <Link
                href="/host/login"
                className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:px-3"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t py-5 text-center text-xs text-muted-foreground">
        Product department · internal use
      </footer>
    </div>
  );
}

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
