import type { Question, QuizDepth, Release, Round } from "./types";

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
/**
 * Awareness depth. Three questions a feature is about five minutes for a whole
 * release, which is as much as a workshop can spare — and the point is that
 * everyone knows the feature exists, not that they can recite it.
 */
const BASIC_PER_FEATURE = 3;
const BASIC_WITH_FLOW = 4;
const TARGET_OPTIONS = 4;
/** Three answers, because two of them have to be plainly wrong to be useful. */
const BASIC_OPTIONS = 3;
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

/**
 * Plainly wrong answers, by question type.
 *
 * Everything else the file offers as a wrong answer is a *true* sentence about
 * some other feature, which makes an awareness question unfair: four true
 * statements, and only the feature name in the question to tell them apart.
 * Somebody who understood the release still cannot answer that. These are
 * written to be wrong about any feature, so the right answer stands out to
 * anybody who was listening — and only to them.
 */
const PLAINLY_WRONG: Record<string, string[]> = {
  behaviour: [
    "Nothing changes — it works exactly as before.",
    "It is switched off until a later release.",
    "You still have to ask IT to do it for you.",
  ],
  whereToSee: [
    "Nothing new appears on screen.",
    "Only an administrator can see it.",
    "It only shows up in the monthly report email.",
  ],
  whoItHelps: [
    "Nobody yet — it only matters to the IT team.",
    "Only staff who work outside the office.",
    "Only new joiners in their first month.",
  ],
  misconception: [
    "None of it applies until the next release.",
    "It only works after IT turns it on for you.",
  ],
  mustKnow: [
    "Nothing in particular — it behaves like the old version.",
    "You have to ask IT before you use it.",
  ],
};

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
function nearMisses(correct: string, withNumbers: boolean): string[] {
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
  // Telling "14 days" from "24 days" is the kind of detail only a daily user
  // needs, so awareness questions never turn on a number.
  if (withNumbers) out.push(...numberSwaps(correct));
  return out;
}

/**
 * Picks the wrong answers.
 *
 * `buckets` are in the order they should be used, best wrong answer first, and
 * a later bucket is only opened when an earlier one runs dry. That order is the
 * whole quality of a question, so it beats everything else — including making
 * the answers a similar length.
 */
function buildOptions(
  correct: string,
  buckets: string[][],
  used: string[],
  seed: string,
  opts: { want: number; matchLength: boolean },
): { options: string[]; correctIndex: number; warning?: string } {
  const taken = new Set([norm(correct), ...used.map(norm)]);
  const picked: string[] = [];

  for (const bucket of buckets) {
    // Within one bucket the wrong answers are equally good, so for the deeper
    // quiz pick the ones closest in length: a right answer that is always the
    // longest can be spotted without knowing anything.
    const ordered = opts.matchLength
      ? [...bucket].sort(
          (a, b) =>
            Math.abs(a.length - correct.length) -
            Math.abs(b.length - correct.length),
        )
      : bucket;
    for (const candidate of ordered) {
      const text = candidate.trim();
      if (!text) continue;
      const key = norm(text);
      if (taken.has(key)) continue;
      taken.add(key);
      picked.push(text);
      if (picked.length >= opts.want - 1) break;
    }
    if (picked.length >= opts.want - 1) break;
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
  } else if (
    opts.matchLength &&
    correct.length > averageWrong * 1.6 &&
    correct.length - averageWrong > 25
  ) {
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

/**
 * Start, middle and end only. Somebody who does not use the feature every day
 * should still know roughly how it goes, without having to remember each click.
 */
function outline(steps: string[]): string[] {
  if (steps.length <= 3) return steps;
  return [
    steps[0],
    steps[Math.floor((steps.length - 1) / 2)],
    steps[steps.length - 1],
  ];
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
  whoItHelps: [
    (n) => `A colleague asks you who ${n} is for. What do you tell them?`,
    (n) => `Who is better off because of ${n}?`,
    (n) => `A customer asks you what ${n} does for them. What do you say?`,
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
  /** Only start, middle and end, so nobody has to remember every click. */
  stepOrderBasic: [
    (n) => `Roughly, in what order does ${n} happen?`,
    (n) => `Which rough order is right for ${n}?`,
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

export function generateQuestions(
  release: Release,
  depth: QuizDepth = "basic",
): Question[] {
  const questions: Question[] = [];
  const basic = depth === "basic";

  release.features.forEach((feature, fIndex) => {
    const others = release.features.filter((f) => f.id !== feature.id);
    const wrongBeliefs = feature.misconceptions.map((m) => m.wrong);
    /**
     * Borrowed wrong answers, used after the near misses are exhausted. Only
     * mistakes other features list, never what another feature actually does:
     * a true line from elsewhere in the release reads as a second right answer.
     */
    const borrowed = [
      ...wrongBeliefs,
      feature.before ?? "",
      ...others.flatMap((o) => o.misconceptions.map((m) => m.wrong)),
    ];
    /**
     * This feature's own wrong answers: the way it used to work, and the
     * mistakes the author said people make. Both are wrong *about this
     * feature*, which is what makes them fair to put next to the right answer.
     */
    const ownWrong = [...wrongBeliefs, feature.before ?? ""];
    const forFeature: Question[] = [];
    /** A flow of 3 steps or more is a cycle worth asking about on its own. */
    const flow = feature.steps.length >= 3 ? feature.steps : [];
    const cap = basic
      ? flow.length
        ? BASIC_WITH_FLOW
        : BASIC_PER_FEATURE
      : flow.length
        ? MAX_WITH_FLOW
        : MAX_PER_FEATURE;

    /** One believable change to the right answer. */
    const misses = (correct: string) => nearMisses(correct, !basic);
    /**
     * The plainly wrong answers, in a different order for each question, so the
     * same sentence does not turn up in every round of the quiz.
     */
    const plainlyWrong = (kind: string, seed: string) =>
      seededShuffle(PLAINLY_WRONG[kind] ?? [], seed);

    const add = (
      kind: Question["kind"],
      stem: string,
      correct: string,
      buckets: string[][],
      extraUsed: string[] = [],
    ) => {
      if (forFeature.length >= cap) return;
      if (!correct.trim()) return;
      const id = `q-${fIndex}-${kind}-${forFeature.length}`;
      const { options, correctIndex, warning } = buildOptions(
        correct,
        [...buckets, plainlyWrong(kind, id)],
        extraUsed,
        id,
        { want: basic ? BASIC_OPTIONS : TARGET_OPTIONS, matchLength: !basic },
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
    const addOrder = (steps: string[], stemKind: string) => {
      if (forFeature.length >= cap) return;
      const id = `q-${fIndex}-stepOrder-${forFeature.length}`;
      const correct = steps.join(ARROW);
      const picked = orderVariants(steps, id)
        .filter((v) => norm(v) !== norm(correct))
        .slice(0, (basic ? BASIC_OPTIONS : TARGET_OPTIONS) - 1);
      if (picked.length < 2) return;
      const options = seededShuffle([correct, ...picked], id);
      forFeature.push({
        id,
        featureId: feature.id,
        featureName: feature.name,
        kind: "stepOrder",
        stem: stemFor(stemKind, feature.name, fIndex),
        options,
        correctIndex: options.findIndex((o) => norm(o) === norm(correct)),
        included: true,
        warning:
          correct.length > TOO_LONG + 40
            ? "This flow is long to read on a phone. Keep each step to about 5 words, or split the feature."
            : undefined,
      });
    };

    // What is new. The old way becomes one of the wrong answers.
    const askWhatIsNew = () => {
      const whatIsNew = sentence(feature.after ?? feature.whatChanged ?? "");
      if (!whatIsNew) return;
      add(
        "behaviour",
        stemFor("behaviour", feature.name, fIndex),
        whatIsNew,
        // Another feature's line is never borrowed here: that line is true, so
        // it would leave two right-looking answers on the screen.
        basic ? [ownWrong, misses(whatIsNew)] : [misses(whatIsNew), ownWrong],
      );
    };

    // What they will actually see, which is what staff ask first.
    const askWhereToSee = () => {
      if (!feature.youSee) return;
      const youSee = sentence(feature.youSee);
      add(
        "whereToSee",
        stemFor("whereToSee", feature.name, fIndex),
        youSee,
        [misses(youSee), ownWrong],
      );
    };

    // Who is better off. Sales and Support get asked this by customers, and it
    // is the one thing somebody who will never open the screen still needs.
    const askWhoItHelps = () => {
      if (!feature.whoItHelps) return;
      const helps = sentence(feature.whoItHelps);
      add(
        "whoItHelps",
        stemFor("whoItHelps", feature.name, fIndex),
        helps,
        [misses(helps)],
      );
    };

    // The cycle in the right order: start to finish for a daily user, only
    // start, middle and end for everybody else.
    const askFlowOrder = () => {
      if (!flow.length) return;
      if (basic) addOrder(outline(flow), "stepOrderBasic");
      else addOrder(flow, "stepOrder");
    };

    // One detail inside the flow. Steps are kept exactly as written: adding a
    // full stop to the right answer only would give it away next to the others.
    const askFlowDetail = () => {
      if (!flow.length) return;
      const otherSteps = (keep: string[]) =>
        flow.filter((s) => !keep.includes(s));
      if (fIndex % 2 === 0) {
        const at = Math.min(1, flow.length - 2);
        add(
          "nextStep",
          `In ${feature.name}, you have just done “${flow[at]}”. What comes next?`,
          flow[at + 1],
          [otherSteps([flow[at], flow[at + 1]])],
        );
      } else {
        add(
          "firstStep",
          stemFor("firstStep", feature.name, fIndex),
          flow[0],
          [otherSteps([flow[0]])],
        );
      }
    };

    // A misconception, when the author wrote one: the wrong answers are then
    // mistakes people really make.
    const withTruth = feature.misconceptions.find((m) => m.truth);
    const askMisconception = () => {
      if (!withTruth?.truth) return;
      const truth = sentence(withTruth.truth);
      add(
        "misconception",
        stemFor("misconception", feature.name, fIndex),
        truth,
        basic ? [ownWrong, misses(truth)] : [misses(truth), ownWrong],
      );
    };

    // The one line the author flagged as must-know.
    const askMustKnow = () => {
      if (!feature.mustKnow.length) return;
      const mustKnow = sentence(feature.mustKnow[0]);
      add(
        "mustKnow",
        stemFor("mustKnow", feature.name, fIndex),
        mustKnow,
        basic ? [ownWrong, misses(mustKnow)] : [misses(mustKnow), ownWrong],
      );
    };

    // True or false. A spare misconception is the best source, and the answer
    // alternates by round so it is not always the same key.
    const askTrueFalse = () => {
      const spare = feature.misconceptions.filter((m) => m.truth)[1] ?? withTruth;
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
    };

    const askLimit = () => {
      if (!feature.limits.length) return;
      const limit = sentence(feature.limits[0]);
      add("limit", stemFor("limit", feature.name, fIndex), limit, [
        misses(limit),
        borrowed,
      ]);
    };

    // A single step, only useful when the file had no full flow.
    const askSingleStep = () => {
      if (flow.length || !feature.steps.length) return;
      const step = sentence(feature.steps[0]);
      add("step", stemFor("step", feature.name, fIndex), step, [
        misses(step),
        borrowed,
      ]);
    };

    /**
     * Order matters more than the cap: the cap just stops when enough is
     * enough, so whatever is listed first is what a feature actually asks.
     * Awareness leads with what changed and who it helps, and never asks about
     * limits or exact numbers.
     */
    const plan = basic
      ? [
          askWhatIsNew,
          askWhereToSee,
          askWhoItHelps,
          askFlowOrder,
          askTrueFalse,
          askMisconception,
          askMustKnow,
        ]
      : [
          askWhatIsNew,
          askWhereToSee,
          askFlowOrder,
          askFlowDetail,
          askMisconception,
          askMustKnow,
          askTrueFalse,
          askWhoItHelps,
          askLimit,
          askSingleStep,
        ];
    for (const ask of plan) ask();

    // One usable question is not a round. Tell the author what to add.
    if (forFeature.length === 1) {
      forFeature[0].warning =
        "Only one question could be built from this feature. Add a “You’ll see:” or “Who it helps:” line.";
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
