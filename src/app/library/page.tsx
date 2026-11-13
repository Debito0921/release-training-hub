import Link from "next/link";
import { BookOpen, CalendarDays, FileUp } from "lucide-react";
import { AppShell, PageTitle } from "@/components/app-shell";
import { canHost, getAccount } from "@/lib/account";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listModules } from "@/lib/store";
import { DeleteReleaseButton } from "./delete-release-button";
import { HostReleaseButton } from "./host-release-button";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const account = await getAccount();
  const isHost = canHost(account?.role);

  // A host also sees their own drafts, so an unfinished import is easy to
  // find again. Everyone else only sees what has been saved to the library.
  const modules = (await listModules(isHost ? account?.id : undefined)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  return (
    <AppShell>
      <PageTitle
        title="Release library"
        description="Every release module stays here. Anyone who missed the workshop can work through it on their own, and practise as many times as they like."
        action={
          isHost ? (
            <Button nativeButton={false} render={<Link href="/host" />}>
              <FileUp className="size-4" />
              Add a release
            </Button>
          ) : null
        }
      />

      {modules.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <BookOpen className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nothing here yet. Upload a release to create the first module.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Card key={m.id} className="flex h-full flex-col">
              <CardHeader>
                <CardTitle className="text-base leading-snug">
                  {m.title}
                </CardTitle>
                {m.status === "draft" ? (
                  <Badge className="mt-1 w-fit">Draft — not saved yet</Badge>
                ) : null}
                {m.goLive ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    Go-live {m.goLive}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {m.departments.map((d) => (
                    <Badge key={d} variant="outline">
                      {d}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.features.length} features ·{" "}
                  {m.questions.filter((q) => q.included).length} questions · pass
                  mark {m.passMark}%
                </p>
                <div className="space-y-2">
                  {m.status === "draft" ? (
                    <Button
                      size="sm"
                      className="w-full"
                      nativeButton={false}
                      render={<Link href={`/host/modules/${m.id}`} />}
                    >
                      Finish checking it
                    </Button>
                  ) : (
                    <>
                      {isHost ? (
                        <HostReleaseButton moduleId={m.id} className="w-full" />
                      ) : null}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        nativeButton={false}
                        render={<Link href={`/library/${m.id}`} />}
                      >
                        Open module
                      </Button>
                    </>
                  )}
                  {isHost && m.status === "ready" && m.ownerId === account?.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      nativeButton={false}
                      render={<Link href={`/host/modules/${m.id}`} />}
                    >
                      Edit the questions
                    </Button>
                  ) : null}
                  {/* Demo releases have no owner, so they are never offered. */}
                  {m.ownerId &&
                  (m.ownerId === account?.id || account?.role === "admin") ? (
                    <DeleteReleaseButton
                      moduleId={m.id}
                      title={m.title}
                      isDraft={m.status === "draft"}
                      className="w-full"
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
