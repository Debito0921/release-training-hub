import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { QuestionEditor } from "./question-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/account";
import { getModule } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount();
  if (!account) redirect("/host/login");

  const module = await getModule(id);
  if (!module) notFound();

  // A host edits their own releases; an admin can fix anybody's.
  if (module.ownerId !== account.id && account.role !== "admin") {
    redirect(`/library/${module.id}`);
  }

  return (
    <AppShell>
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/library" />}
      >
        <ArrowLeft className="size-3.5" />
        Library
      </Button>

      <div className="mt-4 mb-7">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
          {module.title}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge variant={module.status === "draft" ? "default" : "secondary"}>
            {module.status === "draft" ? "Draft" : "In the library"}
          </Badge>
          {module.goLive ? (
            <Badge variant="secondary">Go-live {module.goLive}</Badge>
          ) : null}
          {module.departments.map((d) => (
            <Badge key={d} variant="outline">
              {d}
            </Badge>
          ))}
          <Badge variant="secondary">Pass mark {module.passMark}%</Badge>
        </div>
      </div>

      <QuestionEditor module={module} />
    </AppShell>
  );
}
