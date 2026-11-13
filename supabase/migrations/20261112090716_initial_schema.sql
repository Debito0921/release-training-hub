-- Release Training Hub schema.
--
-- Only the product team signs in. Staff taking the quiz join by QR code and
-- type their own name, so a player row does not need a login.
--
-- Every table has row level security on with no policies, which means the
-- anon and authenticated keys can read nothing at all. All access goes
-- through this app's own server routes using the service role key, which
-- bypasses RLS. That keeps questions.correct_index away from the browser.

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  department  text not null default 'Product',
  role        text not null default 'player'
              check (role in ('player', 'host', 'admin')),
  created_at  timestamptz not null default now()
);

comment on column public.profiles.role is
  'player sees only the quiz. host can upload releases and run sessions. admin can also change other people''s roles.';

-- A profile is created automatically the moment someone registers.
-- The very first account becomes the admin, so there is always someone
-- who can promote the rest of the team.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;

  insert into public.profiles (id, full_name, department, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
             split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'department', ''), 'Product'),
    case when is_first then 'admin' else 'player' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* ------------------------------------------------------------------ */
/* The quiz library                                                    */
/* ------------------------------------------------------------------ */

create table public.modules (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete restrict,
  title            text not null,
  go_live          text,
  departments      text[] not null default '{}',
  pass_mark        int not null default 70 check (pass_mark between 1 and 100),
  -- Kept so a release can be re-read later, or re-generated after a fix.
  source_markdown  text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.modules is
  'One release. Any staff member may read it in the library; only owner_id may change it.';

-- One feature becomes one round of the quiz.
create table public.features (
  id              uuid primary key default gen_random_uuid(),
  module_id       uuid not null references public.modules (id) on delete cascade,
  position        int not null,
  name            text not null,
  what_changed    text,
  why             text,
  before_text     text,
  after_text      text,
  steps           text[] not null default '{}',
  -- [{ "wrong": "...", "truth": "..." }]
  misconceptions  jsonb not null default '[]'::jsonb,
  limits          text[] not null default '{}',
  must_know       text[] not null default '{}',
  unique (module_id, position)
);

create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  module_id      uuid not null references public.modules (id) on delete cascade,
  feature_id     uuid not null references public.features (id) on delete cascade,
  position       int not null,
  kind           text not null
                 check (kind in ('behaviour', 'misconception', 'limit',
                                 'step', 'mustKnow', 'custom')),
  stem           text not null,
  options        text[] not null,
  correct_index  int not null,
  included       boolean not null default true,
  -- Set when the generator could not find enough believable wrong answers.
  warning        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint options_count check (array_length(options, 1) between 2 and 6),
  constraint correct_index_in_range
    check (correct_index >= 0 and correct_index < array_length(options, 1))
);

comment on column public.questions.kind is
  'custom means a person wrote it by hand instead of it coming from the file.';

/* ------------------------------------------------------------------ */
/* Playing                                                             */
/* ------------------------------------------------------------------ */

create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules (id) on delete cascade,
  host_id     uuid not null references public.profiles (id) on delete restrict,
  code        text not null unique,
  status      text not null default 'lobby'
              check (status in ('lobby', 'live', 'ended')),
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- The host opens and closes each round, so nobody races ahead.
create table public.session_rounds (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  feature_id  uuid not null references public.features (id) on delete cascade,
  opened_at   timestamptz,
  closed_at   timestamptz,
  primary key (session_id, feature_id)
);

create table public.session_players (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  -- Null for the normal case: somebody who scanned the QR and typed a name.
  profile_id    uuid references public.profiles (id) on delete set null,
  display_name  text not null,
  department    text not null,
  joined_at     timestamptz not null default now()
);

-- Two people in the same room cannot use the same name.
create unique index session_players_unique_name
  on public.session_players (session_id, lower(display_name));

create table public.answers (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  player_id     uuid not null references public.session_players (id) on delete cascade,
  question_id   uuid not null references public.questions (id) on delete cascade,
  option_index  int not null,
  is_correct    boolean not null,
  -- The library allows unlimited retakes; the dashboard counts attempt 1.
  attempt_no    int not null default 1,
  answered_at   timestamptz not null default now(),
  unique (player_id, question_id, attempt_no)
);

/* ------------------------------------------------------------------ */
/* Indexes for the screens we already have                             */
/* ------------------------------------------------------------------ */

create index modules_owner_idx           on public.modules (owner_id);
create index modules_created_idx         on public.modules (created_at desc);
create index features_module_idx         on public.features (module_id, position);
create index questions_module_idx        on public.questions (module_id, position);
create index questions_feature_idx       on public.questions (feature_id);
create index sessions_module_idx         on public.sessions (module_id);
create index sessions_host_idx           on public.sessions (host_id);
create index session_players_session_idx on public.session_players (session_id);
create index answers_session_idx         on public.answers (session_id);
create index answers_question_idx        on public.answers (question_id);
create index answers_player_idx          on public.answers (player_id);

/* ------------------------------------------------------------------ */
/* Lock everything down                                                */
/* ------------------------------------------------------------------ */

alter table public.profiles        enable row level security;
alter table public.modules         enable row level security;
alter table public.features        enable row level security;
alter table public.questions       enable row level security;
alter table public.sessions        enable row level security;
alter table public.session_rounds  enable row level security;
alter table public.session_players enable row level security;
alter table public.answers         enable row level security;
