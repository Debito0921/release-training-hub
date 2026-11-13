import type { Feature, Misconception, Release } from "./types";

/** Strip markdown noise so label matching is forgiving. */
function clean(line: string): string {
  return line
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*#+\s*/, "")
    .trim();
}

function isListItem(raw: string): boolean {
  return /^\s*([-*+]\s+|\d+[.)]\s+)/.test(raw);
}

/** Labels we understand, each with the aliases an author might type. */
const LABELS: Record<string, string[]> = {
  whatChanged: ["what changed", "what it does", "change", "what is new", "summary"],
  why: ["why", "why we changed it", "reason"],
  before: ["before", "old behaviour", "old behavior", "previously"],
  after: ["after", "new behaviour", "new behavior", "now"],
  steps: ["steps", "steps to use it", "how to use", "how it works"],
  misconception: [
    "misconception",
    "what people will get wrong",
    "common mistake",
    "gets confused",
  ],
  limit: ["limit", "limits", "edge case", "edge cases", "not supported"],
  mustKnow: ["must-know", "must know", "key point", "remember"],
};

function matchLabel(text: string): { key: string; value: string } | null {
  const sep = text.indexOf(":");
  if (sep === -1) return null;
  const label = text.slice(0, sep).trim().toLowerCase();
  const value = text.slice(sep + 1).trim();
  for (const [key, aliases] of Object.entries(LABELS)) {
    if (aliases.includes(label)) return { key, value };
  }
  return null;
}

function slug(text: string, fallback: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || fallback;
}

function emptyFeature(name: string, index: number): Feature {
  return {
    id: `${slug(name, `feature-${index}`)}-${index}`,
    name,
    steps: [],
    misconceptions: [],
    limits: [],
    mustKnow: [],
  };
}

function parseMisconception(value: string): Misconception {
  // "the wrong belief || what is actually true"
  const parts = value.split(/\s*\|\|\s*|\s+--\s+/);
  if (parts.length >= 2) {
    return { wrong: parts[0].trim(), truth: parts.slice(1).join(" ").trim() };
  }
  return { wrong: value.trim() };
}

/** Headings in the intake template that are structure, not features. */
const META_HEADINGS = [
  "release basics",
  "per feature",
  "impact per department",
  "quiz guidance",
  "release content intake template",
  "how questions get built",
  "checklist",
];

function isMetaHeading(text: string): boolean {
  const lower = text.toLowerCase().replace(/^[a-d]\.\s*/, "");
  return META_HEADINGS.some((m) => lower.startsWith(m));
}

export function parseRelease(markdown: string): Release {
  const lines = markdown.split(/\r?\n/);

  const release: Release = {
    title: "Untitled release",
    departments: [],
    passMark: 70,
    features: [],
  };

  let current: Feature | null = null;
  let collecting: "steps" | null = null;
  let sawTitle = false;
  let featureIndex = 0;

  const pushCurrent = () => {
    if (current && hasContent(current)) release.features.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      collecting = null;
      continue;
    }

    // Headings
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].replace(/\*\*/g, "").trim();
      collecting = null;

      if (level === 1 && !sawTitle) {
        release.title = text;
        sawTitle = true;
        continue;
      }
      if (isMetaHeading(text)) {
        pushCurrent();
        continue;
      }
      if (level >= 2) {
        pushCurrent();
        const name = text.replace(/^feature\s*:?\s*/i, "").trim();
        featureIndex += 1;
        current = emptyFeature(name || `Feature ${featureIndex}`, featureIndex);
        continue;
      }
      continue;
    }

    const text = clean(line);
    if (!text) continue;

    // A bare list item while collecting steps
    if (collecting === "steps" && current && isListItem(raw) && !matchLabel(text)) {
      current.steps.push(text.replace(/^\d+[.)]\s*/, "").trim());
      continue;
    }

    const labelled = matchLabel(text);

    if (!labelled) {
      collecting = null;
      continue;
    }

    const { key, value } = labelled;

    // Release-level fields (before any feature heading)
    if (!current) {
      const lower = text.slice(0, text.indexOf(":")).trim().toLowerCase();
      if (lower.startsWith("go-live") || lower.startsWith("go live")) {
        release.goLive = value;
      }
      continue;
    }

    switch (key) {
      case "whatChanged":
        current.whatChanged = value;
        break;
      case "why":
        current.why = value;
        break;
      case "before":
        current.before = value;
        break;
      case "after":
        current.after = value;
        break;
      case "steps":
        if (value) current.steps.push(value);
        collecting = "steps";
        break;
      case "misconception":
        if (value) current.misconceptions.push(parseMisconception(value));
        break;
      case "limit":
        if (value) current.limits.push(value);
        break;
      case "mustKnow":
        if (value) current.mustKnow.push(value);
        break;
    }
  }

  pushCurrent();

  // Release-level meta that can appear anywhere as a plain line
  for (const raw of lines) {
    const text = clean(raw);
    const sep = text.indexOf(":");
    if (sep === -1) continue;
    const label = text.slice(0, sep).trim().toLowerCase();
    const value = text.slice(sep + 1).trim();
    if (label === "departments" && release.departments.length === 0) {
      release.departments = value
        .split(/[,/]/)
        .map((d) => d.trim())
        .filter(Boolean);
    }
    if ((label === "go-live" || label === "go live" || label === "go-live date") && !release.goLive) {
      release.goLive = value;
    }
    if (label === "pass mark") {
      const n = parseInt(value.replace(/[^0-9]/g, ""), 10);
      if (!Number.isNaN(n) && n > 0 && n <= 100) release.passMark = n;
    }
  }

  return release;
}

function hasContent(f: Feature): boolean {
  return Boolean(
    f.whatChanged ||
      f.before ||
      f.after ||
      f.steps.length ||
      f.misconceptions.length ||
      f.limits.length ||
      f.mustKnow.length,
  );
}
