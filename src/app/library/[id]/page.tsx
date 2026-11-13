import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  PencilLine,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canHost, getAccount } from "@/lib/account";
import { getModule } from "@/lib/store";
import { HostReleaseButton } from "../host-release-button";
import { PracticeQuiz } from "./practice-quiz";

export const dynamic = "force-dynamic";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const module = await getModule(id);
  if (!module) notFound();

  const account = await getAccount();
  const isHost = canHost(account?.role);
  // A draft is still being checked, so it stays hidden from everyone else.
  if (
    module.status === "draft" &&
    module.ownerId !== account?.id &&
    account?.role !== "admin"
  ) {
    notFound();
  }

  // Only the questions the host ticked, and only the fields the quiz needs.
  const practice = module.questions
    .filter((q) => q.included)
    .map(({ id, featureName, stem, options, correctIndex }) => ({
      id,
      featureName,
      stem,
      options,
      correctIndex,
    }));

  return (
    <AppShell>
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/library" />}>
        <ArrowLeft className="size-3.5" />
        Library
      </Button>

      <div className="mt-4 mb-7">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight sm:text-3xl">
          {module.title}
        </h1>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {module.goLive ? (
            <Badge variant="secondary">Go-live {module.goLive}</Badge>
          ) : null}
          {module.departments.map((d) => (
            <Badge key={d} variant="outline">
              {d}
            </Badge>
          ))}
          <Badge variant="secondary">{practice.length} questions</Badge>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {practice.length > 0 ? (
            <Button
              size="lg"
              className="h-11 w-full text-base sm:w-auto"
              nativeButton={false}
              render={<Link href="#practice" />}
            >
              <PencilLine className="size-4" />
              Practise the quiz
            </Button>
          ) : null}
          {isHost && module.status === "ready" ? (
            <HostReleaseButton
              moduleId={module.id}
              size="lg"
              variant={practice.length > 0 ? "secondary" : "default"}
              className="h-11 w-full text-base sm:w-auto"
            />
          ) : null}
        </div>
      </div>

      <div className="space-y-5">
        {module.features.map((feature, i) => (
          <Card key={feature.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge>{i + 1}</Badge>
                <CardTitle className="text-lg">{feature.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              {feature.whatChanged ? (
                <p className="font-medium">{feature.whatChanged}</p>
              ) : null}
              {feature.why ? (
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Why: </span>
                  {feature.why}
                </p>
              ) : null}

              {feature.before || feature.after ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {feature.before ? (
                    <div className="rounded-xl border bg-muted/40 p-3.5">
                      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Before
                      </p>
                      <p className="text-muted-foreground">{feature.before}</p>
                    </div>
                  ) : null}
                  {feature.after ? (
                    <div className="rounded-xl border border-primary/30 bg-accent/60 p-3.5">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent-foreground uppercase">
                        After
                        <ArrowRight className="size-3" />
                      </p>
                      <p>{feature.after}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {feature.steps.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    How to use it
                  </p>
                  <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                    {feature.steps.map((s, si) => (
                      <li key={si}>{s}</li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {feature.misconceptions.some((m) => m.truth) ? (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Easy to get wrong
                  </p>
                  <div className="space-y-2">
                    {feature.misconceptions
                      .filter((m) => m.truth)
                      .map((m, mi) => (
                        <div
                          key={mi}
                          className="rounded-xl border border-destructive/25 bg-destructive/5 p-3.5"
                        >
                          <p className="flex items-start gap-2 text-muted-foreground line-through">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                            {m.wrong}
                          </p>
                          <p className="mt-1.5 flex items-start gap-2 font-medium">
                            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-[var(--success)]" />
                            {m.truth}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              {feature.limits.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Limits
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                    {feature.limits.map((l, li) => (
                      <li key={li}>{l}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {feature.mustKnow.length > 0 ? (
                <div className="rounded-xl bg-secondary p-3.5">
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-secondary-foreground uppercase">
                    Must remember
                  </p>
                  <ul className="space-y-1 font-medium">
                    {feature.mustKnow.map((k, ki) => (
                      <li key={ki}>{k}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {practice.length > 0 ? (
        <div id="practice" className="mt-10 scroll-mt-20">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">
            Practise the quiz
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Try the {practice.length} questions on your own, as many times as
            you like. Nothing here is recorded.
          </p>
          <PracticeQuiz questions={practice} passMark={module.passMark} />
        </div>
      ) : null}
    </AppShell>
  );
}
