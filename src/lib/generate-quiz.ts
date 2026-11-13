import type { Question, Release, Round } from "./types";

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
/** A feature with a written flow earns extra questions about that flow. */
const MAX_WITH_FLOW = 6;
const TARGET_OPTIONS = 4;
/** How the steps of a flow are joined when shown as one answer. */
const ARROW = " → ";
/** Roughly 20 words. Longer than this is hard to read on a phone. */
const TOO_LONG = 130;

/**
 * One believable change at a time, because these are the five things people
 * actually get wrong: how often it happens, whether the system does it for
 * them, who does it, where it shows up, and how they are told.
 */
const SWAPS: { find: RegExp; replace: string[] }[] = [
  { find: /\bevery night\b|\bnightly\b|\bovernight\b/i, replace: ["once a week", "every hour"] },
  { find: /\bevery day\b|\bdaily\b/i, replace: ["once a week", "once a month"] },
  { find: /\bevery month\b|\bmonthly\b/i, replace: ["every quarter", "every week"] },
  {
    find: /\bimmediately\b|\binstantly\b|\bstraight away\b|\bright away\b/i,
    replace: ["only the next working day", "only at the end of the month"],
  },
  {
    find: /\bautomatically\b|\bby itself\b|\bon its own\b/i,
    replace: ["only when you ask for it", "only after your manager approves it"],
  },
  { find: /\bmanually\b|\bby hand\b/i, replace: ["automatically"] },
  { find: /\bthe system\b/i, replace: ["your manager", "the admin"] },
  { find: /\byour manager\b/i, replace: ["the system", "the admin"] },
  { find: /\bthe dashboard\b/i, replace: ["the settings page", "the weekly email"] },
  { find: /\bthe home page\b/i, replace: ["the settings page", "the reports page"] },
  { find: /\bthe settings page\b/i, replace: ["the home page", "the reports page"] },
  { find: /\ban email\b/i, replace: ["a pop-up message", "a note in the system only"] },
];

/** Changes the number that carries the most meaning: usually the biggest one. */
function numberSwaps(text: string): string[] {
  const found = [...text.matchAll(/\d+/g)];
  if (!found.length) return [];
  const pick = found.reduce((best, m) =>
    m[0].length >= best[0].length ? m : best,
  );
  const n = parseInt(pick[0], 10);
  const options = [n >= 10 ? n + 10 : n + 1, n >= 4 ? Math.round(n / 2) : n * 3];
  const start = pick.index ?? 0;
  return options
    .filter((c) => c !== n && c > 0)
    .map((c) => text.slice(0, start) + String(c) + text.slice(start + pick[0].length));
}

/**
 * Wrong answers made by changing one believable thing in the right answer.
 * Without these, the only wrong answers available come from other features, and
 * those are so obviously off-topic that the quiz can be passed by elimination.
 */
function nearMisses(correct: string): string[] {
  const out: string[] = [];
  for (const swap of SWAPS) {
    const hit = swap.find.exec(correct);
    if (!hit) continue;
    for (const word of swap.replace) {
      out.push(
        correct.slice(0, hit.index) +
          word +
          correct.slice(hit.index + hit[0].length),
      );
    }
  }
  out.push(...numberSwaps(correct));
  return out;
}

function buildOptions(
  correct: string,
  pool: string[],
  used: string[],
  seed: string,
): { options: string[]; correctIndex: number; warning?: string } {
  const taken = new Set([norm(correct), ...used.map(norm)]);
  // Wrong answers close in length to the right one first. If the right answer
  // is always the longest, it can be spotted without knowing anything.
  const ranked = [...nearMisses(correct), ...pool]
    .filter((text) => text && text.trim())
    .map((text, order) => ({ text: text.trim(), order }))
    .sort(
      (a, b) =>
        Math.abs(a.text.length - correct.length) -
          Math.abs(b.text.length - correct.length) || a.order - b.order,
    );

  const picked: string[] = [];
  for (const candidate of ranked) {
    const key = norm(candidate.text);
    if (taken.has(key)) continue;
    taken.add(key);
    picked.push(candidate.text);
    if (picked.length >= TARGET_OPTIONS - 1) break;
  }

  const options = seededShuffle([correct, ...picked], seed);
  const result: { options: string[]; correctIndex: number; warning?: string } = {
    options,
    correctIndex: options.findIndex((o) => norm(o) === norm(correct)),
  };

  const averageWrong =
    picked.reduce((sum, p) => sum + p.length, 0) / (picked.length || 1);
  if (picked.length < 2) {
    result.warning =
      "Only a few wrong answers available. Add a “Remember:” line, or a second feature to the file, so this is harder to guess.";
  } else if (correct.length > averageWrong * 1.6 && correct.length - averageWrong > 25) {
    result.warning =
      "The right answer is much longer than the wrong ones, which makes it easy to spot. Try shortening it.";
  } else if (Math.max(...options.map((o) => o.length)) > TOO_LONG) {
    result.warning =
      "These answers are long for a phone screen. Aim for about 15 words each.";
  }
  return result;
}

/**
 * Wrong orders for a flow: two steps that swapped places, or the last step
 * pulled to the front. Both are what somebody half-remembering the demo would
 * pick, and neither can be ruled out by reading alone.
 */
function orderVariants(steps: string[], seed: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < steps.length - 1; i += 1) {
    const swapped = [...steps];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    out.push(swapped.join(ARROW));
  }
  out.push([steps[steps.length - 1], ...steps.slice(0, -1)].join(ARROW));
  return seededShuffle([...new Set(out)], seed);
}

function sentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Drops the full stop and the capital, so a line can sit inside a sentence. */
function clause(text: string): string {
  const trimmed = text.trim().replace(/[.]$/, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

/**
 * Several wordings per question type, rotated by round, so a quiz does not ask
 * the same three questions over and over. They are written from the point of
 * view of somebody who is about to use the system, not of the person who built
 * it.
 */
const STEMS: Record<string, ((name: string) => string)[]> = {
  behaviour: [
    (n) => `What is new in ${n}?`,
    (n) => `From this release, what happens with ${n}?`,
    (n) => `A colleague asks you what changed in ${n}. What do you tell them?`,
  ],
  whereToSee: [
    (n) => `Where do you see ${n} in the system?`,
    (n) => `You open the system after go-live. What do you notice for ${n}?`,
    (n) => `What will you actually see for ${n}?`,
  ],
  misconception: [
    (n) => `Which statement about ${n} is correct?`,
    (n) => `Somebody is unsure about ${n}. Which one is right?`,
  ],
  mustKnow: [
    (n) => `For ${n}, which one must you remember?`,
    (n) => `What is the one thing to remember about ${n}?`,
  ],
  stepOrder: [
    (n) => `What is the right order from start to finish for ${n}?`,
    (n) => `You use ${n} for the first time. Which order is correct?`,
    (n) => `Which order gets ${n} done correctly?`,
  ],
  firstStep: [
    (n) => `What do you do first in ${n}?`,
    (n) => `Where does ${n} start?`,
  ],
  limit: [(n) => `Which of these is a known limit of ${n}?`],
  step: [(n) => `Which of these is a correct step when using ${n}?`],
};

function stemFor(kind: string, name: string, round: number): string {
  const variants = STEMS[kind];
  return variants[round % variants.length](name);
}

export function generateQuestions(release: Release): Question[] {
  const questions: Question[] = [];

  release.features.forEach((feature, fIndex) => {
    const others = release.features.filter((f) => f.id !== feature.id);
    const wrongBeliefs = feature.misconceptions.map((m) => m.wrong);
    // Borrowed wrong answers, used after the near misses are exhausted. Lines
    // from the same feature come first, because they are at least on topic.
    const borrowed = [
      ...wrongBeliefs,
      feature.before ?? "",
      ...others.flatMap((o) => o.misconceptions.map((m) => m.wrong)),
      ...others.map((o) => o.after ?? ""),
    ];
    const placePool = [
      ...others.map((o) => o.youSee ?? ""),
      ...borrowed,
    ];
    const forFeature: Question[] = [];
    /** A flow of 3 steps or more is a cycle worth asking about on its own. */
    const flow = feature.steps.length >= 3 ? feature.steps : [];
    const cap = flow.length ? MAX_WITH_FLOW : MAX_PER_FEATURE;

    const add = (
      kind: Question["kind"],
      stem: string,
      correct: string,
      pool: string[] = borrowed,
      extraUsed: string[] = [],
    ) => {
      if (forFeature.length >= cap) return;
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

    /** True or false, which is quick to answer and breaks up the round. */
    const addTrueFalse = (statement: string, isTrue: boolean) => {
      if (forFeature.length >= cap) return;
      if (!statement.trim()) return;
      const id = `q-${fIndex}-trueFalse-${forFeature.length}`;
      forFeature.push({
        id,
        featureId: feature.id,
        featureName: feature.name,
        kind: "trueFalse",
        stem: `True or false: ${sentence(statement)}`,
        options: ["True", "False"],
        correctIndex: isTrue ? 0 : 1,
        included: true,
      });
    };

    /**
     * The whole job in one answer. This is the question that shows whether
     * somebody could actually sit down and do it, instead of only recognising
     * the words, so the wrong answers are the same steps in a wrong order.
     */
    const addOrder = (steps: string[]) => {
      if (forFeature.length >= cap) return;
      const id = `q-${fIndex}-stepOrder-${forFeature.length}`;
      const correct = steps.join(ARROW);
      const picked = orderVariants(steps, id)
        .filter((v) => norm(v) !== norm(correct))
        .slice(0, TARGET_OPTIONS - 1);
      if (picked.length < 2) return;
      const options = seededShuffle([correct, ...picked], id);
      forFeature.push({
        id,
        featureId: feature.id,
        featureName: feature.name,
        kind: "stepOrder",
        stem: stemFor("stepOrder", feature.name, fIndex),
        options,
        correctIndex: options.findIndex((o) => norm(o) === norm(correct)),
        included: true,
        warning:
          correct.length > TOO_LONG + 40
            ? "This flow is long to read on a phone. Keep each step to about 5 words, or split the feature."
            : undefined,
      });
    };

    // 1. What is new. The old way becomes one of the wrong answers.
    const whatIsNew = feature.after ?? feature.whatChanged;
    if (whatIsNew) {
      add("behaviour", stemFor("behaviour", feature.name, fIndex), sentence(whatIsNew));
    }

    // 2. What they will actually see, which is what staff ask first.
    if (feature.youSee) {
      add(
        "whereToSee",
        stemFor("whereToSee", feature.name, fIndex),
        sentence(feature.youSee),
        placePool,
      );
    }

    // 3. The full cycle, then one detail inside it. Knowing the order is what
    //    tells us somebody can do the job, not just name it.
    if (flow.length) {
      addOrder(flow);
      const otherSteps = (keep: string[]) =>
        flow.filter((s) => !keep.includes(s));
      // Steps are kept exactly as written: adding a full stop to the right
      // answer only would give it away next to the other steps.
      if (fIndex % 2 === 0) {
        const at = Math.min(1, flow.length - 2);
        add(
          "nextStep",
          `In ${feature.name}, you have just done “${flow[at]}”. What comes next?`,
          flow[at + 1],
          otherSteps([flow[at], flow[at + 1]]),
        );
      } else {
        add(
          "firstStep",
          stemFor("firstStep", feature.name, fIndex),
          flow[0],
          otherSteps([flow[0]]),
        );
      }
    }

    // 4. A misconception, when the author wrote one: the wrong answers are then
    //    mistakes people really make.
    const first = feature.misconceptions.find((m) => m.truth);
    if (first?.truth) {
      add(
        "misconception",
        stemFor("misconception", feature.name, fIndex),
        sentence(first.truth),
      );
    }

    // 5. The one line the author flagged as must-know.
    if (feature.mustKnow.length) {
      add("mustKnow", stemFor("mustKnow", feature.name, fIndex), sentence(feature.mustKnow[0]));
    }

    // 6. True or false. A spare misconception is the best source, and the
    //    answer alternates by round so it is not always the same key.
    const spare = feature.misconceptions.filter((m) => m.truth)[1] ?? first;
    const useTruth = fIndex % 2 === 0;
    if (spare?.truth) {
      addTrueFalse(useTruth ? spare.truth : spare.wrong, useTruth);
    } else if (useTruth && (feature.after ?? feature.whatChanged)) {
      // Keep True and False both in play, or the answer becomes guessable.
      addTrueFalse(
        `from this release, ${clause((feature.after ?? feature.whatChanged)!)}`,
        true,
      );
    } else if (feature.before) {
      // The old way is no longer true.
      addTrueFalse(`from this release, ${clause(feature.before)}`, false);
    }

    // 7. Limits, and a single step when the file had no full flow.
    if (feature.limits.length) {
      add("limit", stemFor("limit", feature.name, fIndex), sentence(feature.limits[0]));
    }
    if (!flow.length && feature.steps.length) {
      add("step", stemFor("step", feature.name, fIndex), sentence(feature.steps[0]));
    }

    // One usable question is not a round. Tell the author what to add.
    if (forFeature.length === 1) {
      forFeature[0].warning =
        "Only one question could be built from this feature. Add a “You’ll see:” or “Remember:” line.";
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
