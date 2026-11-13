export type Department =
  | "Sales"
  | "Support"
  | "Finance"
  | "HR"
  | "Product"
  | "Others";

export type Misconception = {
  wrong: string;
  truth?: string;
};

export type Feature = {
  id: string;
  name: string;
  whatChanged?: string;
  why?: string;
  before?: string;
  after?: string;
  /** What the person will actually see on screen: "You'll see:" in the file. */
  youSee?: string;
  /** Who is better off because of this, and how: "Who it helps:" in the file. */
  whoItHelps?: string;
  steps: string[];
  misconceptions: Misconception[];
  limits: string[];
  mustKnow: string[];
};

export type Release = {
  title: string;
  goLive?: string;
  departments: string[];
  passMark: number;
  features: Feature[];
};

/**
 * How deep the questions go. Most people only need to know a release happened
 * and roughly what it does for them, so `basic` is the default; `full` is for
 * the people who will use the feature every day.
 */
export type QuizDepth = "basic" | "full";

export type QuestionKind =
  | "behaviour"
  /** Where in the system the change shows up. */
  | "whereToSee"
  /** Who is better off, which is what a colleague or customer asks about. */
  | "whoItHelps"
  | "misconception"
  /** A single statement to accept or reject. */
  | "trueFalse"
  /** The whole job from start to finish, in the right order. */
  | "stepOrder"
  /** What you do first. */
  | "firstStep"
  /** What happens straight after one step. */
  | "nextStep"
  | "limit"
  | "step"
  | "mustKnow"
  /** Written or reworded by a host, instead of coming from the file. */
  | "custom";

export type Question = {
  id: string;
  featureId: string;
  featureName: string;
  kind: QuestionKind;
  stem: string;
  options: string[];
  correctIndex: number;
  included: boolean;
  /** Set when we could not find enough believable wrong answers. */
  warning?: string;
};

export type Round = {
  index: number;
  featureId: string;
  featureName: string;
  questionIds: string[];
};

/** A draft is still being checked by its host and stays out of the library. */
export type ModuleStatus = "draft" | "ready";

export type ReleaseModule = {
  id: string;
  /** Empty for the made-up demo releases, which belong to nobody. */
  ownerId: string;
  status: ModuleStatus;
  title: string;
  goLive?: string;
  departments: string[];
  passMark: number;
  features: Feature[];
  questions: Question[];
  rounds: Round[];
  createdAt: number;
};

export type Staff = {
  id: string;
  name: string;
  department: Department;
};

export type Player = {
  id: string;
  /**
   * Only set for the seeded history, which was built from the staff list.
   * People who join a live session type their own name instead.
   */
  staffId?: string;
  name: string;
  department: Department;
  joinedAt: number;
};

export type Answer = {
  playerId: string;
  questionId: string;
  optionIndex: number;
  correct: boolean;
  attemptNo: number;
  answeredAt: number;
};

export type SessionStatus = "lobby" | "live" | "ended";

export type Session = {
  id: string;
  code: string;
  moduleId: string;
  status: SessionStatus;
  /** Round indexes the host has opened. */
  openRounds: number[];
  /** Round indexes the host has closed. */
  closedRounds: number[];
  players: Player[];
  answers: Answer[];
  createdAt: number;
  endedAt?: number;
};
