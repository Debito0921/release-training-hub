import { STAFF } from "./staff";
import { createAdminClient } from "./supabase/server";
import { ALL_DEPARTMENTS } from "./store";
import type { Department } from "./types";

/**
 * Who the business is. People joining a quiz type their own name, Kahoot
 * style, so the only way to follow somebody across releases is to tie that
 * typed name back to one of these records.
 *
 * Two sources: staff who registered an account, and the HR name list. The
 * list is sample data until the real one is uploaded.
 */
export type Person = {
  id: string;
  name: string;
  department: Department;
  /** account = they have a login. list = they are only on the name list. */
  source: "account" | "list";
};

/** Lower case, single spaces, no punctuation — "Ah Meng" and "ah  meng" match. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listPeople(): Promise<Person[]> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, department")
    .order("full_name");

  const accounts: Person[] = ((data ?? []) as {
    id: string;
    full_name: string;
    department: string;
  }[]).map((row) => ({
    id: row.id,
    name: row.full_name,
    department:
      ALL_DEPARTMENTS.find((d) => d === row.department) ?? "Others",
    source: "account",
  }));

  const taken = new Set(accounts.map((a) => normaliseName(a.name)));
  const listed: Person[] = STAFF.filter(
    (s) => !taken.has(normaliseName(s.name)),
  ).map((s) => ({ ...s, source: "list" }));

  return [...accounts, ...listed];
}

export async function findPerson(id: string): Promise<Person | undefined> {
  return (await listPeople()).find((p) => p.id === id);
}
