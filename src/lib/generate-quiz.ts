import type { Feature, Question, Release, Round } from "./types";

/** Small deterministic RNG so option order is stable between renders. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hash(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s.,;:!?]+/g, " ");

const MAX_PER_FEATURE = 4;
const TARGET_OPTIONS = 4;

/** Wrong answers worth using, best first. */
function distractorPool(feature: Feature, others: Feature[]): string[] {
  const pool: string[] = [];
  // Real misconceptions are the most valuable wrong answers.
  for (const m of feature.misconceptions) pool.push(m.wrong);
  // The old behaviour is a believable wrong answer.
  if (feature.before) pool.push(feature.before);
  // Then misconceptions and behaviours from the rest of the release.
  for (const o of others) {
    for (const m of o.misconceptions) pool.push(m.wrong);
  }
  for (const o of others) {
    if (o.after) pool.push(o.after);
  }
  return pool;
}

function buildOptions(
  correct: string,
  pool: string[],
  used: string[],
  seed: string,
): { options: string[]; correctIndex: number; warning?: string } {
  const taken = new Set([norm(correct), ...used.map(norm)]);
  const picked: string[] = [];
  for (const candidate of pool) {
    const key = norm(candidate);
    if (taken.has(key)) continue;
    taken.add(key);
    picked.push(candidate);
    if (picked.length >= TARGET_OPTIONS - 1) break;
  }

  const options = seededShuffle([correct, ...picked], seed);
  const result: { options: string[]; correctIndex: number; warning?: string } = {
    options,
    correctIndex: options.findIndex((o) => norm(o) === norm(correct)),
  };
  if (picked.length < 2) {
    result.warning =
      "Only a few wrong answers available. Add more Misconception lines to this feature to make it harder to guess.";
  }
  return result;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function generateQuestions(release: Release): Question[] {
  const questions: Question[] = [];

  release.features.forEach((feature, fIndex) => {
    const others = release.features.filter((f) => f.id !== feature.id);
    const pool = distractorPool(feature, others);
    const forFeature: Question[] = [];

    const add = (
      kind: Question["kind"],
      stem: string,
      correct: string,
      extraUsed: string[] = [],
    ) => {
      if (forFeature.length >= MAX_PER_FEATURE) return;
      if (!correct.trim()) return;
      const id = `q-${fIndex}-${kind}-${forFeature.length}`;
      const { options, correctIndex, warning } = buildOptions(
        correct,
        pool,
        extraUsed,
        id,
      );
      if (options.length < 2) return;
      forFeature.push({
        id,
        featureId: feature.id,
        featureName: feature.name,
        kind,
        stem,
        options,
        correctIndex,
        included: true,
        warning,
      });
    };

    // 1. What the behaviour is now (uses the old behaviour as a wrong answer).
    if (feature.after) {
      add(
        "behaviour",
        `${feature.name} — what happens under the new release?`,
        sentence(feature.after),
      );
    }

    // 2. Misconceptions: the strongest questions, because the wrong answers are real.
    feature.misconceptions.forEach((m, i) => {
      if (!m.truth) return;
      if (i === 0) {
        add(
          "misconception",
          `Which statement about ${feature.name} is correct?`,
          sentence(m.truth),
        );
      } else {
        add(
          "misconception",
          `A colleague says: “${sentence(m.wrong)}” What is the correct position?`,
          sentence(m.truth),
          [m.wrong],
        );
      }
    });

    // 3. Limits — what it does not do.
    if (feature.limits.length) {
      add(
        "limit",
        `Which of these is a known limit of ${feature.name}?`,
        sentence(feature.limits[0]),
      );
    }

    // 4. Must-know points the host flagged.
    if (feature.mustKnow.length) {
      add(
        "mustKnow",
        `For ${feature.name}, which of these must you remember?`,
        sentence(feature.mustKnow[0]),
      );
    }

    // 5. Steps, only if we still have room.
    if (feature.steps.length) {
      add(
        "step",
        `Which of these is a correct step when using ${feature.name}?`,
        sentence(feature.steps[0]),
      );
    }

    questions.push(...forFeature);
  });

  return questions;
}

export function buildRounds(release: Release, questions: Question[]): Round[] {
  return release.features
    .map((feature, index) => ({
      index,
      featureId: feature.id,
      featureName: feature.name,
      questionIds: questions
        .filter((q) => q.featureId === feature.id)
        .map((q) => q.id),
    }))
    .filter((r) => r.questionIds.length > 0)
    .map((r, i) => ({ ...r, index: i }));
}
