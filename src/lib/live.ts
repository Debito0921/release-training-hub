import { createAdminClient } from "./supabase/server";
import type { Department, Session } from "./types";

/**
 * Live rooms in the database, so the quiz survives being published.
 *
 * On a laptop one process held every room in memory and that was enough. Once
 * the app is hosted, each request can land on a different server, and those
 * servers share nothing but this database. Everything a player's phone asks
 * for — the room, who is in it, what they answered — has to come from here.
 *
 * Uses the service role key like the rest of the server code: the tables are
 * locked down and these routes are the only way in.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True for anything the database made. The three made-up past releases, and
 * the rooms that go with them, are generated in memory and keep their own
 * `mod_seed_…` / `ses_seed_…` ids.
 */
export function isDbId(id: string): boolean {
  return UUID.test(id);
}

type PlayerRow = {
  id: string;
  person_id: string | null;
  display_name: string;
  department: string;
  joined_at: string;
};

type AnswerRow = {
  player_id: string;
  question_id: string;
  option_index: number;
  is_correct: boolean;
  attempt_no: number;
  answered_at: string;
};

type SessionRow = {
  id: string;
  code: string;
  module_id: string;
  status: Session["status"];
  open_rounds: number[];
  closed_rounds: number[];
  created_at: string;
  ended_at: string | null;
  session_players: PlayerRow[];
  answers: AnswerRow[];
};

const SELECT = `
  id, code, module_id, status, open_rounds, closed_rounds, created_at, ended_at,
  session_players (id, person_id, display_name, department, joined_at),
  answers (player_id, question_id, option_index, is_correct, attempt_no, answered_at)
`;

const DEPARTMENTS: Department[] = [
  "Sales",
  "Support",
  "Finance",
  "HR",
  "Product",
  "Others",
];

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    code: row.code,
    moduleId: row.module_id,
    status: row.status,
    openRounds: [...row.open_rounds].sort((a, b) => a - b),
    closedRounds: [...row.closed_rounds].sort((a, b) => a - b),
    players: [...row.session_players]
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
      .map((p) => ({
        id: p.id,
        staffId: p.person_id ?? undefined,
        name: p.display_name,
        department: DEPARTMENTS.find((d) => d === p.department) ?? "Others",
        joinedAt: new Date(p.joined_at).getTime(),
      })),
    answers: row.answers.map((a) => ({
      playerId: a.player_id,
      questionId: a.question_id,
      optionIndex: a.option_index,
      correct: a.is_correct,
      attemptNo: a.attempt_no,
      answeredAt: new Date(a.answered_at).getTime(),
    })),
    createdAt: new Date(row.created_at).getTime(),
    endedAt: row.ended_at ? new Date(row.ended_at).getTime() : undefined,
  };
}

/** Short code for the QR link, easy to read out loud if a camera fails. */
function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/** Postgres code for "that would break a unique rule". */
const DUPLICATE = "23505";

export async function createLiveSession(
  moduleId: string,
  hostId: string,
): Promise<Session | { error: string }> {
  const admin = createAdminClient();

  // The code is five characters, so a clash is possible. Let the database
  // decide and try again, rather than checking first and hoping.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await admin
      .from("sessions")
      .insert({ module_id: moduleId, host_id: hostId, code: makeCode() })
      .select(SELECT)
      .single();

    if (!error && data) return toSession(data as unknown as SessionRow);
    if (error?.code !== DUPLICATE) {
      return { error: "The room could not be opened. Please try again." };
    }
  }
  return { error: "The room could not be opened. Please try again." };
}

export async function getLiveSession(id: string): Promise<Session | undefined> {
  if (!isDbId(id)) return undefined;
  const { data } = await createAdminClient()
    .from("sessions")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? toSession(data as unknown as SessionRow) : undefined;
}

export async function getLiveSessionByCode(
  code: string,
): Promise<Session | undefined> {
  const { data } = await createAdminClient()
    .from("sessions")
    .select(SELECT)
    .eq("code", code.toUpperCase())
    .maybeSingle();
  return data ? toSession(data as unknown as SessionRow) : undefined;
}

export async function listLiveSessions(): Promise<Session[]> {
  const { data } = await createAdminClient()
    .from("sessions")
    .select(SELECT)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as SessionRow[]).map(toSession);
}

export async function addLivePlayer(
  sessionId: string,
  name: string,
  department: Department,
  personId?: string,
) {
  const { data, error } = await createAdminClient()
    .from("session_players")
    .insert({
      session_id: sessionId,
      person_id: personId ?? null,
      display_name: name,
      department,
    })
    .select("id, person_id, display_name, department, joined_at")
    .single();

  if (error || !data) {
    if (error?.code === DUPLICATE) {
      return {
        error: error.message.includes("person")
          ? "That person has already joined this room from another phone."
          : "Somebody in this room already used that name. Add your surname or initial.",
      } as const;
    }
    return { error: "Joining did not work. Please try again." } as const;
  }

  const row = data as PlayerRow;
  return {
    player: {
      id: row.id,
      staffId: row.person_id ?? undefined,
      name: row.display_name,
      department,
      joinedAt: new Date(row.joined_at).getTime(),
    },
  } as const;
}

export async function recordLiveAnswer(
  sessionId: string,
  playerId: string,
  questionId: string,
  optionIndex: number,
  correct: boolean,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await createAdminClient().from("answers").insert({
    session_id: sessionId,
    player_id: playerId,
    question_id: questionId,
    option_index: optionIndex,
    is_correct: correct,
  });

  // A slow phone can send the same tap twice; the database refuses the second.
  if (error?.code === DUPLICATE) {
    return { error: "You have already answered that question." };
  }
  if (error) return { error: "That answer did not save. Please try again." };
  return { ok: true };
}

export async function setLiveRounds(
  sessionId: string,
  rounds: { open: number[]; closed: number[] },
  status?: Session["status"],
): Promise<void> {
  await createAdminClient()
    .from("sessions")
    .update({
      open_rounds: rounds.open,
      closed_rounds: rounds.closed,
      ...(status ? { status } : {}),
    })
    .eq("id", sessionId);
}

export async function endLiveSession(
  sessionId: string,
  closed: number[],
): Promise<void> {
  await createAdminClient()
    .from("sessions")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      closed_rounds: closed,
    })
    .eq("id", sessionId);
}
