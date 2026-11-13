import { generateQuestions } from "./generate-quiz";
import { parseRelease } from "./parse-release";
import { createAdminClient } from "./supabase/server";
import type {
  Feature,
  Question,
  QuizDepth,
  ReleaseModule,
  Round,
} from "./types";

/**
 * The release library lives in Supabase, so an uploaded release and any later
 * edits survive a restart. Everything here uses the service role key, which
 * bypasses row level security: the tables are locked down and this app's own
 * server routes are the only way in.
 */

type ModuleRow = {
  id: string;
  owner_id: string;
  title: string;
  go_live: string | null;
  departments: string[];
  pass_mark: number;
  status: "draft" | "ready";
  created_at: string;
};

type FeatureRow = {
  id: string;
  position: number;
  name: string;
  what_changed: string | null;
  why: string | null;
  before_text: string | null;
  after_text: string | null;
  you_see: string | null;
  who_it_helps: string | null;
  steps: string[];
  misconceptions: { wrong: string; truth?: string }[];
  limits: string[];
  must_know: string[];
};

type QuestionRow = {
  id: string;
  feature_id: string;
  position: number;
  kind: Question["kind"];
  stem: string;
  options: string[];
  correct_index: number;
  included: boolean;
  warning: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODULE_COLUMNS =
  "id, owner_id, title, go_live, departments, pass_mark, status, created_at";
const FEATURE_COLUMNS =
  "id, position, name, what_changed, why, before_text, after_text, you_see, who_it_helps, steps, misconceptions, limits, must_know";
const QUESTION_COLUMNS =
  "id, feature_id, position, kind, stem, options, correct_index, included, warning";

function toFeature(row: FeatureRow): Feature {
  return {
    id: row.id,
    name: row.name,
    whatChanged: row.what_changed ?? undefined,
    why: row.why ?? undefined,
    before: row.before_text ?? undefined,
    after: row.after_text ?? undefined,
    youSee: row.you_see ?? undefined,
    whoItHelps: row.who_it_helps ?? undefined,
    steps: row.steps,
    misconceptions: row.misconceptions,
    limits: row.limits,
    mustKnow: row.must_know,
  };
}

function toQuestion(row: QuestionRow, featureName: string): Question {
  return {
    id: row.id,
    featureId: row.feature_id,
    featureName,
    kind: row.kind,
    stem: row.stem,
    options: row.options,
    correctIndex: row.correct_index,
    included: row.included,
    warning: row.warning ?? undefined,
  };
}

function assemble(
  moduleRow: ModuleRow,
  featureRows: FeatureRow[],
  questionRows: QuestionRow[],
): ReleaseModule {
  const features = featureRows.map(toFeature);
  const names = new Map(featureRows.map((f) => [f.id, f.name]));
  const questions = questionRows.map((q) =>
    toQuestion(q, names.get(q.feature_id) ?? ""),
  );

  const rounds: Round[] = features
    .map((feature) => ({
      index: 0,
      featureId: feature.id,
      featureName: feature.name,
      questionIds: questions
        .filter((q) => q.featureId === feature.id)
        .map((q) => q.id),
    }))
    .filter((r) => r.questionIds.length > 0)
    .map((r, i) => ({ ...r, index: i }));

  return {
    id: moduleRow.id,
    ownerId: moduleRow.owner_id,
    status: moduleRow.status,
    title: moduleRow.title,
    goLive: moduleRow.go_live ?? undefined,
    departments: moduleRow.departments,
    passMark: moduleRow.pass_mark,
    features,
    questions,
    rounds,
    createdAt: new Date(moduleRow.created_at).getTime(),
  };
}

/** Reads a release from the file, then stores it with its questions. */
export async function createDbModule(
  markdown: string,
  ownerId: string,
  depth: QuizDepth = "basic",
): Promise<ReleaseModule> {
  const release = parseRelease(markdown);
  if (release.features.length === 0) {
    throw new Error(
      "No features found in that file. Each feature needs its own `## Feature: name` heading.",
    );
  }
  const questions = generateQuestions(release, depth);
  if (questions.length === 0) {
    throw new Error(
      "The file was read, but there was nothing to build questions from. Add After, Misconception or Must-know lines to each feature.",
    );
  }

  const db = createAdminClient();

  const { data: moduleRow, error: moduleError } = await db
    .from("modules")
    .insert({
      owner_id: ownerId,
      title: release.title,
      go_live: release.goLive ?? null,
      departments: release.departments,
      pass_mark: release.passMark,
      source_markdown: markdown,
      // The host checks the questions before this becomes playable.
      status: "draft",
    })
    .select(MODULE_COLUMNS)
    .single<ModuleRow>();
  if (moduleError || !moduleRow) {
    throw new Error("Could not save the release. Please try again.");
  }

  const { data: featureRows, error: featureError } = await db
    .from("features")
    .insert(
      release.features.map((feature, position) => ({
        module_id: moduleRow.id,
        position,
        name: feature.name,
        what_changed: feature.whatChanged ?? null,
        why: feature.why ?? null,
        before_text: feature.before ?? null,
        after_text: feature.after ?? null,
        you_see: feature.youSee ?? null,
        who_it_helps: feature.whoItHelps ?? null,
        steps: feature.steps,
        misconceptions: feature.misconceptions,
        limits: feature.limits,
        must_know: feature.mustKnow,
      })),
    )
    .select(FEATURE_COLUMNS)
    .order("position");
  if (featureError || !featureRows) {
    await db.from("modules").delete().eq("id", moduleRow.id);
    throw new Error("Could not save the features. Please try again.");
  }

  // The parser gives every feature a temporary id; swap it for the stored one.
  const featureIdByPosition = new Map(
    (featureRows as FeatureRow[]).map((row) => [row.position, row.id]),
  );
  const dbFeatureId = new Map(
    release.features.map((feature, position) => [
      feature.id,
      featureIdByPosition.get(position) ?? "",
    ]),
  );

  const { data: questionRows, error: questionError } = await db
    .from("questions")
    .insert(
      questions.map((question, position) => ({
        module_id: moduleRow.id,
        feature_id: dbFeatureId.get(question.featureId),
        position,
        kind: question.kind,
        stem: question.stem,
        options: question.options,
        correct_index: question.correctIndex,
        included: question.included,
        warning: question.warning ?? null,
      })),
    )
    .select(QUESTION_COLUMNS)
    .order("position");
  if (questionError || !questionRows) {
    await db.from("modules").delete().eq("id", moduleRow.id);
    throw new Error("Could not save the questions. Please try again.");
  }

  return assemble(
    moduleRow,
    featureRows as FeatureRow[],
    questionRows as QuestionRow[],
  );
}

export async function getDbModule(
  id: string,
): Promise<ReleaseModule | undefined> {
  // Stored ids are uuids, so anything else cannot be in the database.
  if (!UUID.test(id)) return undefined;
  const db = createAdminClient();
  const { data: moduleRow } = await db
    .from("modules")
    .select(MODULE_COLUMNS)
    .eq("id", id)
    .maybeSingle<ModuleRow>();
  if (!moduleRow) return undefined;

  const [{ data: featureRows }, { data: questionRows }] = await Promise.all([
    db.from("features").select(FEATURE_COLUMNS).eq("module_id", id).order("position"),
    db.from("questions").select(QUESTION_COLUMNS).eq("module_id", id).order("position"),
  ]);

  return assemble(
    moduleRow,
    (featureRows ?? []) as FeatureRow[],
    (questionRows ?? []) as QuestionRow[],
  );
}

/**
 * Ready releases, plus the drafts belonging to `draftsFor` so a host can
 * pick up a release they have not finished checking yet.
 */
export async function listDbModules(
  draftsFor?: string,
): Promise<ReleaseModule[]> {
  const db = createAdminClient();
  let query = db.from("modules").select(MODULE_COLUMNS);
  // The id goes straight into a filter string, so only accept a real uuid.
  query = draftsFor && UUID.test(draftsFor)
    ? query.or(`status.eq.ready,owner_id.eq.${draftsFor}`)
    : query.eq("status", "ready");
  const { data: moduleRows } = await query.order("created_at", {
    ascending: false,
  });
  if (!moduleRows?.length) return [];

  const ids = (moduleRows as ModuleRow[]).map((m) => m.id);
  const [{ data: featureRows }, { data: questionRows }] = await Promise.all([
    db.from("features").select(`module_id, ${FEATURE_COLUMNS}`).in("module_id", ids).order("position"),
    db.from("questions").select(`module_id, ${QUESTION_COLUMNS}`).in("module_id", ids).order("position"),
  ]);

  type WithModule<T> = T & { module_id: string };
  const features = (featureRows ?? []) as WithModule<FeatureRow>[];
  const questions = (questionRows ?? []) as WithModule<QuestionRow>[];

  return (moduleRows as ModuleRow[]).map((moduleRow) =>
    assemble(
      moduleRow,
      features.filter((f) => f.module_id === moduleRow.id),
      questions.filter((q) => q.module_id === moduleRow.id),
    ),
  );
}

export async function setDbQuestionIncluded(
  moduleId: string,
  questionId: string,
  included: boolean,
): Promise<void> {
  const db = createAdminClient();
  await db
    .from("questions")
    .update({ included, updated_at: new Date().toISOString() })
    .eq("id", questionId)
    .eq("module_id", moduleId);
}

export type QuestionEdit = {
  stem: string;
  options: string[];
  correctIndex: number;
};

/**
 * Checks what a host typed and drops the blank answers. Returns a sentence to
 * show them, or the cleaned question ready to store.
 */
function checkQuestion(
  edit: QuestionEdit,
): { problem: string } | { stem: string; options: string[]; correct: number } {
  const stem = edit.stem.trim();
  if (stem.length < 8) {
    return { problem: "Please write a question of at least 8 letters." };
  }

  const options = edit.options.map((o) => o.trim()).filter(Boolean);
  if (options.length < 2) {
    return { problem: "A question needs at least 2 answers." };
  }
  if (options.length > 6) {
    return { problem: "A question can have at most 6 answers." };
  }

  const seen = new Set(options.map((o) => o.toLowerCase()));
  if (seen.size !== options.length) {
    return { problem: "Two answers are the same. Make each one different." };
  }

  // The host may have deleted the answer that used to be the right one.
  const correct = edit.options
    .map((o, i) => ({ o: o.trim(), i }))
    .filter(({ o }) => o)
    .findIndex(({ i }) => i === edit.correctIndex);
  if (correct < 0) {
    return { problem: "Please tick which answer is the right one." };
  }

  return { stem, options, correct };
}

/**
 * Saves a host's wording. The question is marked `custom` afterwards, because
 * it no longer matches what the file said.
 */
export async function updateDbQuestion(
  moduleId: string,
  questionId: string,
  edit: QuestionEdit,
): Promise<string | undefined> {
  const checked = checkQuestion(edit);
  if ("problem" in checked) return checked.problem;
  const { stem, options, correct } = checked;

  const db = createAdminClient();
  const { error } = await db
    .from("questions")
    .update({
      stem,
      options,
      correct_index: correct,
      kind: "custom",
      updated_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .eq("module_id", moduleId);
  return error ? "Could not save that question. Please try again." : undefined;
}

/**
 * Adds a question a host wrote by hand. `topic` is the heading it is filed
 * under, which is also the round it will be asked in; an unknown topic becomes
 * a new one, so a release can be built without any file at all.
 */
export async function addDbQuestion(
  moduleId: string,
  topic: string,
  edit: QuestionEdit,
): Promise<{ problem?: string }> {
  const name = topic.trim();
  if (name.length < 2) return { problem: "Please give the topic a name." };

  const checked = checkQuestion(edit);
  if ("problem" in checked) return { problem: checked.problem };
  const { stem, options, correct } = checked;

  const db = createAdminClient();
  const { data: featureRows } = await db
    .from("features")
    .select("id, position, name")
    .eq("module_id", moduleId)
    .order("position");
  const features = (featureRows ?? []) as {
    id: string;
    position: number;
    name: string;
  }[];

  let featureId = features.find(
    (f) => f.name.toLowerCase() === name.toLowerCase(),
  )?.id;
  if (!featureId) {
    const { data: created } = await db
      .from("features")
      .insert({
        module_id: moduleId,
        position: features.length,
        name,
      })
      .select("id")
      .single<{ id: string }>();
    if (!created) return { problem: "Could not save the topic. Please try again." };
    featureId = created.id;
  }

  const { count } = await db
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("module_id", moduleId);

  const { error } = await db.from("questions").insert({
    module_id: moduleId,
    feature_id: featureId,
    position: count ?? 0,
    kind: "custom",
    stem,
    options,
    correct_index: correct,
    included: true,
  });
  return error
    ? { problem: "Could not save that question. Please try again." }
    : {};
}

/** An empty release, for a host who would rather type the questions in. */
export async function createBlankModule(
  title: string,
  ownerId: string,
): Promise<ReleaseModule> {
  const clean = title.trim();
  if (clean.length < 3) {
    throw new Error("Please give the release a name of at least 3 letters.");
  }

  const { data: moduleRow, error } = await createAdminClient()
    .from("modules")
    .insert({
      owner_id: ownerId,
      title: clean,
      departments: [],
      source_markdown: "",
      status: "draft",
    })
    .select(MODULE_COLUMNS)
    .single<ModuleRow>();
  if (error || !moduleRow) {
    throw new Error("Could not create the release. Please try again.");
  }
  return assemble(moduleRow, [], []);
}

export async function setDbModuleStatus(
  moduleId: string,
  status: "draft" | "ready",
): Promise<void> {
  const db = createAdminClient();
  await db
    .from("modules")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", moduleId);
}
