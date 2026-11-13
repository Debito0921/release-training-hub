# Release Training Hub

A live, Kahoot-style training quiz that gets a whole company up to speed on a new product release — and then shows the product team who actually understood it.

Built for an HR management system (HRMS) product team whose monthly releases have to be understood by Sales, Support, Finance and HR colleagues who are not product experts.

**Live:** [release-training-hub.vercel.app](https://release-training-hub.vercel.app) — the library and the join screen are open to anyone; the host console and the results dashboard need a host account.

> Status: working internal tool, built as a portfolio project. The release library, accounts, permissions and live sessions all live in Supabase, so a quiz can be hosted from the deployed site and joined from any phone.

---

## The problem

Every month the product team ships enhancements to the HRMS, runs a workshop for the other departments, and then has no idea what landed. The usual symptoms:

- The workshop ends and nobody knows who understood what.
- Writing quiz questions by hand for every release is slow, so it does not happen.
- Attendance gets tracked. Understanding does not.
- The same thing confuses people release after release, because nothing is measured.

## What it does

**For the product team (host)**

- **Turn a release note into a quiz.** Drop in a Markdown release note and the app splits it into rounds and generates multiple-choice questions — one round per feature.
- **Or write it by hand.** No file needed: start an empty release and type questions in. The "topic" you file each question under becomes its round.
- **Edit before anyone sees it.** Reword any question, untick the ones you do not want to ask, add your own, then save it to the library. Correct answers are only ever shown to the host.
- **Run the room.** Join code and QR code on screen, rounds opened and closed one at a time, live leaderboard.
- **See the result.** Pass rate per release, pass rate per department, the questions people got wrong most often, and a per-person follow-up list.

**For everyone else (players)**

- **Join from a phone in two taps.** Scan the QR code, type your name, pick your department. No account, no password, and no need to be on the host's Wi-Fi: the QR points at the deployed site, and only falls back to a LAN address when the app is being run from the host's own laptop.
- **"Is this you?"** While you type, the app offers matching names from the staff list. Tapping one ties the session to that person, so your history follows you from one release to the next.
- **Practise alone.** Any saved release can be replayed solo from the library, as often as you like. Practice runs are deliberately **not** recorded.

## Product decisions worth calling out

These were the interesting calls, not the code:

| Decision | Why |
| --- | --- |
| Practice scores are never saved | The headline metric is the **first-attempt pass rate**. If practice counted, the number would only ever go up and would stop meaning anything. |
| Players type their own name, Kahoot-style | Asking 20 non-technical colleagues to create accounts before a workshop kills the workshop. Identity is recovered afterwards by matching the typed name to the staff list. |
| Host controls are hidden, not just blocked | A player who taps a host button and gets "access denied" has been told the product does not trust them. If it is not for you, you should not see it. |
| Every department is always selectable when joining | An earlier version only offered the departments a release targeted — so a Finance colleague sitting in the room had no button to press. Targeted departments now simply sort first. |
| Results roll up per person, not per session | "Who still has not understood the new claims flow?" is the question a product owner actually asks. |
| Questions are generated without an LLM at runtime | The thinking already happened when the product team wrote the release note. Parsing it is instant, free, repeatable, and a host can always edit the result. |

## How it works

```
Markdown release note ──▶ parse ──▶ rounds + questions ──▶ library (Supabase)
                                                              │
                                       host starts a session ──┤
                                                              ▼
  phone ──QR / join code──▶ live session ──▶ answers ──▶ results dashboard
```

- **Release parsing** (`src/lib/parse-release.ts`) reads a structured Markdown template: one heading per feature, with what changed, who it affects, and the before/after behaviour.
- **Question generation** (`src/lib/generate-quiz.ts`) is deterministic. It builds different question kinds out of the facts in the note — what changed, who is affected, what the old behaviour was — and flags anything it is unsure about so the host reviews it before saving.
- **The library** (`src/lib/library.ts`) stores releases, features and questions in Supabase, with a `draft` → `ready` status so an unfinished release cannot be hosted.
- **Live sessions** (`src/lib/live.ts`) are rows in Postgres: the room, who joined, every answer. They started out in memory, which only works while one machine serves everybody — on a platform that runs several servers, a player's phone can land on one that never heard of the room. The database also settles the races one process used to settle for free: two phones claiming the same name, or one phone sending the same tap twice.
- **Accounts and permissions** use Supabase Auth. The first account becomes the admin; everyone else registers as a player, and an admin promotes the product team to `host`. Middleware (`src/middleware.ts`) keeps host-only pages and APIs closed while everything a player needs stays open.
- **Row Level Security** is on for every table with no public policies, so the database is only ever reached through the app's own server routes.

## Screens

| Route | Who | What |
| --- | --- | --- |
| `/host` | Host | Upload a release note, or start an empty release |
| `/host/modules/[id]` | Host | Review and edit the questions, add your own, save to the library |
| `/host/[id]` | Host | Run the live session: join code, QR, rounds, leaderboard |
| `/host/people` | Admin | Promote a colleague to host |
| `/library`, `/library/[id]` | Everyone | Saved releases, with a solo practice run |
| `/join`, `/join/[code]` | Players | Join by code or QR and pick a name |
| `/play/[id]` | Players | Answer the questions on a phone |
| `/dashboard` | Host | Pass rates, weak questions, per-person follow-up |

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (on Base UI)
- **recharts** for the results charts
- **Supabase** (Postgres + Auth, RLS enabled) via the Supabase CLI and SQL migrations
- Mobile-first throughout, because most people take the quiz on a phone

## Data model

Eight tables, created by the migrations in `supabase/migrations/`:

| Table | Holds |
| --- | --- |
| `profiles` | One row per account: name, department, and a role of `player` / `host` / `admin` |
| `modules` | A release: title, go-live date, pass mark, target departments, status |
| `features` | The sections of a release; each one becomes a round |
| `questions` | Stem, options, correct answer, kind, and whether it is included |
| `sessions`, `session_players`, `answers` | A room, who joined it, and what they answered. `session_players.person_id` is how a typed name is tied back to a real person |

## Running it yourself

```bash
npm install
npm run dev
```

Create `.env.local` with your own Supabase keys:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Apply the schema with the Supabase CLI:

```bash
supabase link
supabase db push
```

The first account you register becomes the admin.

## What is next

- Flag a question back to its author when the correct-rate stays low across releases
- A one-click wipe of the sample history before the first real release

---

The staff names and the three historical releases on the dashboard are demo data. Built with Next.js, Supabase and Claude Code.
