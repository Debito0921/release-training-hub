import { NextResponse } from "next/server";
import { listPeople, normaliseName } from "@/lib/people";
import { DEPARTMENTS, STAFF } from "@/lib/staff";
import { getModule, listSessions } from "@/lib/store";

const pct = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 100);

export async function GET() {
  // Only finished sessions count towards the official numbers.
  const sessions = listSessions()
    .filter((s) => s.status === "ended")
    .sort((a, b) => a.createdAt - b.createdAt);

  const computed = await Promise.all(sessions.map(async (session) => {
    const module = await getModule(session.moduleId);
    const questions = module?.questions.filter((q) => q.included) ?? [];
    const total = questions.length;
    const passMark = module?.passMark ?? 70;

    const participants = session.players.map((p) => {
      const mine = session.answers.filter((a) => a.playerId === p.id);
      const correct = mine.filter((a) => a.correct).length;
      return {
        // Who this was, as far as we can tell: the staff record they tapped,
        // or failing that the name they typed.
        key: p.staffId ?? `typed:${normaliseName(p.name)}`,
        matched: !!p.staffId,
        name: p.name,
        department: p.department,
        answered: mine.length,
        correct,
        score: pct(correct, total),
        passed: pct(correct, total) >= passMark,
        finished: mine.length === total,
      };
    });

    const expected = STAFF.filter(
      (s) =>
        !module?.departments.length || module.departments.includes(s.department),
    ).length;

    const byDepartment = DEPARTMENTS.map((dept) => {
      const rows = participants.filter((p) => p.department === dept);
      return {
        department: dept,
        participants: rows.length,
        passRate: pct(rows.filter((r) => r.passed).length, rows.length),
        avgScore: rows.length
          ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length)
          : 0,
      };
    }).filter((d) => d.participants > 0);

    const byQuestion = questions.map((q) => {
      const answers = session.answers.filter((a) => a.questionId === q.id);
      return {
        id: q.id,
        stem: q.stem,
        featureName: q.featureName,
        kind: q.kind,
        answered: answers.length,
        correctRate: pct(answers.filter((a) => a.correct).length, answers.length),
      };
    });

    const release = {
      sessionId: session.id,
      title: module?.title ?? "Release",
      goLive: module?.goLive,
      date: session.createdAt,
      passMark,
      questionCount: total,
      expected,
      participants: participants.length,
      completionRate: pct(
        participants.filter((p) => p.finished).length,
        expected,
      ),
      passRate: pct(participants.filter((p) => p.passed).length, participants.length),
      avgScore: participants.length
        ? Math.round(
            participants.reduce((sum, p) => sum + p.score, 0) / participants.length,
          )
        : 0,
      byDepartment,
      byQuestion,
    };

    return { release, rows: participants };
  }));

  const releases = computed.map((c) => c.release);

  // One row per person, not per session: this is what tells the product team
  // who still has not understood a release, or never turned up at all.
  const people = await listPeople();
  const seen = new Map<
    string,
    {
      name: string;
      department: string;
      matched: boolean;
      /** Release titles, not sessions: the same release can be run twice. */
      titles: Set<string>;
      passed: Set<string>;
      lastScore: number;
    }
  >();

  for (const { release, rows } of computed) {
    for (const row of rows) {
      const found =
        seen.get(row.key) ??
        seen
          .set(row.key, {
            name: row.name,
            department: row.department,
            matched: row.matched,
            titles: new Set<string>(),
            passed: new Set<string>(),
            lastScore: 0,
          })
          .get(row.key)!;
      found.titles.add(release.title);
      if (row.passed) found.passed.add(release.title);
      found.lastScore = row.score;
    }
  }

  // Staff who never joined a single session would otherwise be invisible here.
  for (const person of people) {
    if (seen.has(person.id)) continue;
    const typed = `typed:${normaliseName(person.name)}`;
    if (seen.has(typed)) continue;
    seen.set(person.id, {
      name: person.name,
      department: person.department,
      matched: true,
      titles: new Set<string>(),
      passed: new Set<string>(),
      lastScore: 0,
    });
  }

  const allTitles = [...new Set(releases.map((r) => r.title))];
  const staff = [...seen.entries()]
    .map(([key, row]) => ({
      key,
      name: row.name,
      department: row.department,
      matched: row.matched,
      taken: row.titles.size,
      releaseCount: allTitles.length,
      passes: row.passed.size,
      lastScore: row.titles.size ? row.lastScore : null,
      missing: allTitles.filter((t) => !row.titles.has(t)),
    }))
    .sort(
      (a, b) =>
        a.passes - b.passes || a.taken - b.taken || a.name.localeCompare(b.name),
    );

  const hardest = releases
    .flatMap((r) =>
      r.byQuestion.map((q) => ({ ...q, release: r.title })),
    )
    .filter((q) => q.answered > 0)
    .sort((a, b) => a.correctRate - b.correctRate)
    .slice(0, 8);

  return NextResponse.json({ releases, hardest, staff });
}
