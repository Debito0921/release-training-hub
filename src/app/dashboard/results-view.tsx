"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReleaseResult = {
  sessionId: string;
  title: string;
  date: number;
  passMark: number;
  questionCount: number;
  expected: number;
  participants: number;
  completionRate: number;
  passRate: number;
  avgScore: number;
  byDepartment: {
    department: string;
    participants: number;
    passRate: number;
    avgScore: number;
  }[];
  byQuestion: {
    id: string;
    stem: string;
    featureName: string;
    kind: string;
    answered: number;
    correctRate: number;
  }[];
};

// One row per person, matched back to the staff list where we could.
type StaffResult = {
  key: string;
  name: string;
  department: string;
  matched: boolean;
  taken: number;
  releaseCount: number;
  passes: number;
  lastScore: number | null;
  missing: string[];
};

type Payload = {
  releases: ReleaseResult[];
  hardest: (ReleaseResult["byQuestion"][number] & { release: string })[];
  staff: StaffResult[];
};

const shortTitle = (title: string) => title.split("—")[0].trim();

export function ResultsView() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    fetch("/api/results", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ releases: [], hardest: [], staff: [] }));
  }, []);

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.releases.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <p className="text-sm text-muted-foreground">
            No finished sessions yet. Results appear here once you end a live
            session.
          </p>
        </CardContent>
      </Card>
    );
  }

  const latest = data.releases[data.releases.length - 1];
  const previous = data.releases[data.releases.length - 2];
  const delta = previous ? latest.passRate - previous.passRate : null;

  // Only people who have not passed everything: the list is for chasing, so a
  // fully up-to-date person does not belong on it.
  const behind = data.staff.filter((p) => p.passes < p.releaseCount).length;
  const followUp = data.staff
    .filter((p) => p.passes < p.releaseCount)
    .slice(0, 10);

  const trend = data.releases.map((r) => ({
    name: shortTitle(r.title),
    passRate: r.passRate,
    avgScore: r.avgScore,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Pass rate, latest release"
          value={`${latest.passRate}%`}
          hint={
            delta === null
              ? latest.title
              : `${delta >= 0 ? "+" : ""}${delta} points vs last release`
          }
          good={latest.passRate >= 80}
        />
        <Kpi
          label="Average score"
          value={`${latest.avgScore}%`}
          hint={`Pass mark ${latest.passMark}%`}
        />
        <Kpi
          label="Completion"
          value={`${latest.completionRate}%`}
          hint={`${latest.participants} of ${latest.expected} staff`}
        />
        <Kpi
          label="Questions asked"
          value={String(latest.questionCount)}
          hint={`${latest.byDepartment.length} departments took part`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-primary" />
              Pass rate over releases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      `${value}%`,
                      name === "passRate" ? "Pass rate" : "Average score",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="passRate"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pass rate by department · {shortTitle(latest.title)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={latest.byDepartment}
                  margin={{ left: -20, right: 8, top: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value}%`, "Pass rate"]}
                  />
                  <Bar dataKey="passRate" radius={[6, 6, 0, 0]}>
                    {latest.byDepartment.map((d) => (
                      <Cell
                        key={d.department}
                        fill={
                          d.passRate >= latest.passMark
                            ? "var(--chart-3)"
                            : "var(--chart-5)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Questions people got wrong most often
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            This is the list to bring to the next workshop.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead className="hidden sm:table-cell">Release</TableHead>
                <TableHead className="text-right">Got it right</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.hardest.map((q) => (
                <TableRow key={`${q.release}-${q.id}`}>
                  <TableCell className="max-w-md">
                    <p className="text-sm font-medium">{q.stem}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {q.featureName}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {shortTitle(q.release)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={q.correctRate >= 70 ? "secondary" : "destructive"}
                    >
                      {q.correctRate}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {followUp.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who needs a follow-up</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sorted by who is furthest behind. Practice runs are not counted
            here.
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Department
                </TableHead>
                <TableHead className="text-right">Passed</TableHead>
                <TableHead className="text-right">Last score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {followUp.map((p) => (
                <TableRow key={p.key}>
                  <TableCell>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.taken === 0
                        ? "Has not joined any quiz yet"
                        : p.missing.length > 0
                          ? `Missed ${p.missing.length} of ${p.releaseCount} releases`
                          : "Joined every release"}
                      {p.matched ? "" : " · name not on the staff list"}
                    </p>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                    {p.department}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {p.passes}/{p.releaseCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.lastScore === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge
                        variant={
                          p.lastScore >= latest.passMark
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {p.lastScore}%
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {behind > followUp.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {behind - followUp.length} more people are behind as well.
            </p>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Every release</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Release</TableHead>
                <TableHead className="text-right">Took part</TableHead>
                <TableHead className="text-right">Avg score</TableHead>
                <TableHead className="text-right">Pass rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.releases
                .slice()
                .reverse()
                .map((r) => (
                  <TableRow key={r.sessionId}>
                    <TableCell className="text-sm font-medium">
                      {r.title}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.participants}/{r.expected}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.avgScore}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={r.passRate >= 80 ? "secondary" : "destructive"}
                      >
                        {r.passRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  good,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={`mt-1.5 font-[family-name:var(--font-display)] text-3xl font-bold ${
            good === undefined
              ? ""
              : good
                ? "text-[var(--success)]"
                : "text-destructive"
          }`}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
