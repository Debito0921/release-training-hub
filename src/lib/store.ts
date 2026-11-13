import { buildRounds, generateQuestions } from "./generate-quiz";
import {
  createDbModule,
  getDbModule,
  listDbModules,
  setDbQuestionIncluded,
} from "./library";
import { parseRelease } from "./parse-release";
import { STAFF } from "./staff";
import type { Answer, Department, ReleaseModule, Session } from "./types";

/**
 * Real releases live in Supabase (see library.ts). This in-memory store holds
 * live sessions, plus the made-up past releases that give the results
 * dashboard something to show. Demo data stays out of the database on purpose,
 * so the real library only ever contains the team's own work.
 */
type Store = {
  /** Demo releases only. Real ones are read from the database. */
  modules: ReleaseModule[];
  sessions: Session[];
  seeded: boolean;
};

const globalForStore = globalThis as unknown as { __trainingHub?: Store };

function createStore(): Store {
  return { modules: [], sessions: [], seeded: false };
}

export function getStore(): Store {
  if (!globalForStore.__trainingHub) {
    globalForStore.__trainingHub = createStore();
  }
  const store = globalForStore.__trainingHub;
  if (!store.seeded) {
    store.seeded = true;
    seedHistory(store);
  }
  return store;
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Short code for the QR link, easy to read out loud if the camera fails. */
function makeCode(existing: string[]): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = "";
    for (let i = 0; i < 5; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!existing.includes(code)) return code;
  }
  return `${Date.now()}`.slice(-5);
}

export function createModule(
  markdown: string,
  ownerId: string,
): Promise<ReleaseModule> {
  return createDbModule(markdown, ownerId);
}

function demoModule(id: string): ReleaseModule | undefined {
  return getStore().modules.find((m) => m.id === id);
}

export async function getModule(id: string): Promise<ReleaseModule | undefined> {
  return demoModule(id) ?? (await getDbModule(id));
}

export async function listModules(
  draftsFor?: string,
): Promise<ReleaseModule[]> {
  const saved = await listDbModules(draftsFor);
  return [...saved, ...getStore().modules];
}

export async function setQuestionIncluded(
  moduleId: string,
  questionId: string,
  included: boolean,
): Promise<void> {
  const demo = demoModule(moduleId);
  if (demo) {
    const question = demo.questions.find((q) => q.id === questionId);
    if (question) question.included = included;
    return;
  }
  await setDbQuestionIncluded(moduleId, questionId, included);
}

export function createSession(moduleId: string): Session {
  const store = getStore();
  const session: Session = {
    id: randomId("ses"),
    code: makeCode(store.sessions.map((s) => s.code)),
    moduleId,
    status: "lobby",
    openRounds: [],
    closedRounds: [],
    players: [],
    answers: [],
    createdAt: Date.now(),
  };
  store.sessions.unshift(session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return getStore().sessions.find((s) => s.id === id);
}

export function getSessionByCode(code: string): Session | undefined {
  return getStore().sessions.find(
    (s) => s.code.toUpperCase() === code.toUpperCase(),
  );
}

export function listSessions(): Session[] {
  return getStore().sessions;
}

export const ALL_DEPARTMENTS: Department[] = [
  "Sales",
  "Support",
  "Finance",
  "HR",
  "Product",
  "Others",
];

// The product team already has their accounts, and the admin seat is taken by
// the first of them, so anyone registering now is from the rest of the
// business. Product is left out to keep the choice honest.
export const SIGNUP_DEPARTMENTS: Department[] = ALL_DEPARTMENTS.filter(
  (d) => d !== "Product",
);

export function addPlayer(
  sessionId: string,
  rawName: string,
  rawDepartment: string,
  /** Set when they said "that's me" to somebody on the staff list. */
  person?: { id: string; name: string; department: Department },
) {
  const session = getSession(sessionId);
  if (!session) return { error: "That session no longer exists." } as const;

  if (person && session.players.some((p) => p.staffId === person.id)) {
    return {
      error: "That person has already joined this room from another phone.",
    } as const;
  }

  const name = (person?.name ?? rawName).trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    return { error: "Please type a name with at least 2 letters." } as const;
  }
  if (name.length > 24) {
    return { error: "That name is too long. Keep it under 24 letters." } as const;
  }

  const department =
    person?.department ?? ALL_DEPARTMENTS.find((d) => d === rawDepartment);
  if (!department) {
    return { error: "Please tap your department." } as const;
  }

  const taken = session.players.some(
    (p) => p.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    return {
      error: "Somebody in this room already used that name. Add your surname or initial.",
    } as const;
  }

  const player = {
    id: randomId("ply"),
    staffId: person?.id,
    name,
    department,
    joinedAt: Date.now(),
  };
  session.players.push(player);
  return { player } as const;
}

export async function recordAnswer(
  sessionId: string,
  playerId: string,
  questionId: string,
  optionIndex: number,
): Promise<{ ok: true } | { error: string }> {
  const session = getSession(sessionId);
  if (!session) return { error: "That session no longer exists." };
  const module = await getModule(session.moduleId);
  if (!module) return { error: "That release module no longer exists." };

  const question = module.questions.find((q) => q.id === questionId);
  if (!question) return { error: "We could not find that question." };

  const round = module.rounds.find((r) => r.questionIds.includes(questionId));
  if (!round) return { error: "That question is not part of any round." };
  if (!session.openRounds.includes(round.index)) {
    return { error: "That round is not open." };
  }
  if (session.closedRounds.includes(round.index)) {
    return { error: "The host has already closed that round." };
  }

  const already = session.answers.find(
    (a) => a.playerId === playerId && a.questionId === questionId,
  );
  if (already) return { error: "You have already answered that question." };

  session.answers.push({
    playerId,
    questionId,
    optionIndex,
    correct: optionIndex === question.correctIndex,
    attemptNo: 1,
    answeredAt: Date.now(),
  });
  return { ok: true };
}

export function openRound(sessionId: string, index: number): void {
  const session = getSession(sessionId);
  if (!session) return;
  if (!session.openRounds.includes(index)) session.openRounds.push(index);
  session.closedRounds = session.closedRounds.filter((i) => i !== index);
  session.status = "live";
}

export function closeRound(sessionId: string, index: number): void {
  const session = getSession(sessionId);
  if (!session) return;
  if (!session.closedRounds.includes(index)) session.closedRounds.push(index);
}

export async function endSession(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  if (!session) return;
  session.status = "ended";
  session.endedAt = Date.now();
  const module = await getModule(session.moduleId);
  if (module) {
    module.rounds.forEach((r) => {
      if (!session.closedRounds.includes(r.index)) session.closedRounds.push(r.index);
    });
  }
}

export function scoreFor(session: Session, playerId: string) {
  const answers = session.answers.filter((a) => a.playerId === playerId);
  const correct = answers.filter((a) => a.correct).length;
  return { answered: answers.length, correct };
}

export function leaderboard(session: Session) {
  return session.players
    .map((p) => {
      const { answered, correct } = scoreFor(session, p.id);
      return { ...p, answered, correct };
    })
    .sort((a, b) => b.correct - a.correct || a.joinedAt - b.joinedAt);
}

/* ------------------------------------------------------------------ */
/* Seeded history, so the results dashboard has something to show.     */
/* ------------------------------------------------------------------ */

const PAST_RELEASES = [
  `# Aug 2026 — Claims & Expense Rework

Go-live: 29 Aug 2026
Departments: Sales, Support, Finance, HR

## Feature: Receipt photo upload
After: Staff photograph the receipt in the app and the amount is read automatically.
Before: Staff typed the amount by hand and emailed a scan to Finance.
Misconception: The scan replaces the approval step. || Finance still approves every claim, the scan only fills in the amount.
Misconception: Any photo quality works. || Blurred photos are rejected and must be retaken.
Limit: Receipts above RM 5,000 still need a printed copy.
Must-know: Finance still approves every claim.

## Feature: Monthly claim cut-off
After: Claims submitted after the 25th are paid in the following month's cycle.
Before: Claims were paid whenever Finance processed them.
Misconception: The cut-off is the end of the month. || The cut-off is the 25th.
Misconception: Late claims are rejected. || Late claims are not rejected, they move to the next cycle.
Must-know: The cut-off is the 25th, not month end.`,

  `# Sep 2026 — Payslip Self-Service

Go-live: 26 Sep 2026
Departments: Sales, Support, Finance, HR

## Feature: Self-service payslip download
After: Staff download any payslip from the last 24 months themselves.
Before: Staff emailed HR and waited for a reply.
Misconception: HR can no longer issue payslips. || HR can still issue one, self-service is just the faster route.
Misconception: All history is available. || Only the last 24 months are available online.
Limit: Payslips older than 24 months still need an HR request.
Must-know: Only the last 24 months are self-service.

## Feature: EPF and tax summary tab
After: A yearly summary of EPF and tax deductions appears in its own tab.
Before: Staff added up each payslip by hand.
Misconception: The summary is a tax filing document. || It is a summary only, the official form still comes from Finance.
Must-know: The summary is not an official filing document.`,

  `# Oct 2026 — Shift Roster Planner

Go-live: 31 Oct 2026
Departments: Sales, Support, HR

## Feature: Drag and drop roster
After: Managers drag staff onto shifts and clashes are highlighted in red straight away.
Before: Rosters were planned in a spreadsheet and clashes were found late.
Misconception: The planner blocks a clash. || It warns about a clash but still lets the manager override it with a reason.
Misconception: Staff see the roster immediately. || Staff only see it once the manager publishes it.
Limit: The planner handles up to 60 staff per roster.
Must-know: Staff see nothing until the roster is published.`,
];

function seedHistory(store: Store) {
  // Deterministic pseudo-random, so the dashboard looks the same every reload.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  PAST_RELEASES.forEach((markdown, releaseIndex) => {
    const release = parseRelease(markdown);
    const questions = generateQuestions(release);
    const module: ReleaseModule = {
      id: `mod_seed_${releaseIndex}`,
      ownerId: "",
      status: "ready",
      title: release.title,
      goLive: release.goLive,
      departments: release.departments,
      passMark: release.passMark,
      features: release.features,
      questions,
      rounds: buildRounds(release, questions),
      createdAt: Date.now() - (3 - releaseIndex) * 30 * 86400000,
    };
    store.modules.push(module);

    // Each past release gets better, which gives the trend chart a shape.
    const baseSkill = 0.55 + releaseIndex * 0.08;
    const attending = STAFF.filter(
      (s) => release.departments.length === 0 || release.departments.includes(s.department),
    ).filter(() => rand() > 0.15);

    const session: Session = {
      id: `ses_seed_${releaseIndex}`,
      code: `SEED${releaseIndex}`,
      moduleId: module.id,
      status: "ended",
      openRounds: module.rounds.map((r) => r.index),
      closedRounds: module.rounds.map((r) => r.index),
      players: attending.map((s) => ({
        id: `ply_seed_${releaseIndex}_${s.id}`,
        staffId: s.id,
        name: s.name,
        department: s.department,
        joinedAt: module.createdAt,
      })),
      answers: [],
      createdAt: module.createdAt,
      endedAt: module.createdAt + 1800000,
    };

    const answers: Answer[] = [];
    session.players.forEach((player) => {
      // Support and HR know the product better than Sales and Finance.
      const bonus =
        player.department === "Support" || player.department === "HR" ? 0.1 : 0;
      questions.forEach((q) => {
        // Limit questions are consistently the hardest.
        const penalty = q.kind === "limit" ? 0.18 : 0;
        const chance = Math.min(0.97, Math.max(0.15, baseSkill + bonus - penalty));
        const correct = rand() < chance;
        const wrongIndexes = q.options
          .map((_, i) => i)
          .filter((i) => i !== q.correctIndex);
        answers.push({
          playerId: player.id,
          questionId: q.id,
          optionIndex: correct
            ? q.correctIndex
            : wrongIndexes[Math.floor(rand() * wrongIndexes.length)] ?? 0,
          correct,
          attemptNo: 1,
          answeredAt: module.createdAt,
        });
      });
    });
    session.answers = answers;
    store.sessions.push(session);
  });
}
