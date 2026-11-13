import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  FileUp,
  QrCode,
  Sparkles,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { canHost, getAccount } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    icon: FileUp,
    title: "1 · Upload the release notes",
    body: "Drop in the release file you wrote for the workshop. One markdown file, that is all.",
  },
  {
    icon: Sparkles,
    title: "2 · Questions appear",
    body: "Questions are built straight from your notes, using the real misconceptions as the wrong answers.",
  },
  {
    icon: QrCode,
    title: "3 · They scan and play",
    body: "Put the QR code on screen at the end of your workshop. Staff join on their phones, no password.",
  },
  {
    icon: BarChart3,
    title: "4 · You see what landed",
    body: "Pass rate by release, by department, and the exact questions people got wrong.",
  },
];

export default async function Home() {
  const isHost = canHost((await getAccount())?.role);

  return (
    <AppShell>
      <section className="mb-10 text-center sm:mb-14">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          HR management system · product release training
        </p>
        <h1 className="mx-auto max-w-3xl font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight sm:text-5xl">
          Turn release notes into a quiz your team actually remembers
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Run your workshop as usual. Then put a QR code on the screen and find
          out, in five minutes, who really understood the new release.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isHost ? (
            <Button
              nativeButton={false} render={<Link href="/host" />}
              size="lg"
              className="w-full sm:w-auto"
            >
              <FileUp className="size-4" />
              Upload a release
            </Button>
          ) : null}
          <Button
            nativeButton={false} render={<Link href="/join" />}
            size="lg"
            variant={isHost ? "outline" : "default"}
            className="w-full sm:w-auto"
          >
            <Users className="size-4" />
            Join a quiz
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => (
          <Card key={step.title} className="h-full">
            <CardHeader>
              <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <step.icon className="size-4" />
              </span>
              <CardTitle className="text-sm font-semibold">
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section
        className={
          isHost
            ? "mt-10 grid gap-4 sm:grid-cols-3"
            : "mx-auto mt-10 grid max-w-md gap-4"
        }
      >
        {isHost ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="size-4 text-primary" />
                Live session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Compulsory, right after the workshop. You open and close each
                round, so nobody races ahead.
              </p>
              <Button nativeButton={false} render={<Link href="/host" />} variant="secondary" size="sm">
                Start hosting
              </Button>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-4 text-primary" />
              Self-paced library
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Voluntary, for anyone who missed the workshop or wants to practise
              before a customer call.
            </p>
            <Button nativeButton={false} render={<Link href="/library" />} variant="secondary" size="sm">
              Open library
            </Button>
          </CardContent>
        </Card>
        {isHost ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-primary" />
                Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                First-attempt pass rate per release, plus the questions that
                most people failed.
              </p>
              <Button nativeButton={false} render={<Link href="/dashboard" />} variant="secondary" size="sm">
                View results
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
