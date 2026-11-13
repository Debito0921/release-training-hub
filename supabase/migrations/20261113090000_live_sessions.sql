-- Live rooms move out of the server's memory and into these tables.
--
-- Why: in memory only works while one machine serves everybody. Published on
-- Vercel, several servers answer at once and none of them share memory, so a
-- player's phone could ask a server that had never heard of the room. That is
-- also what makes joining from mobile data safe, instead of needing the host's
-- Wi-Fi.
--
-- The tables were created with the first schema and never used, so this only
-- shapes them to what the app actually does.

-- Which rounds the host has opened and closed. The dedicated session_rounds
-- table keyed rounds by feature; the app numbers them instead, and that number
-- is a property of the room, so two small arrays are the honest shape.
alter table public.sessions
  add column open_rounds   int[] not null default '{}',
  add column closed_rounds int[] not null default '{}';

comment on column public.sessions.open_rounds is
  'Round numbers the host has opened. A round is one feature of the release.';

drop table public.session_rounds;

-- Who the player is, when they said "that is me". It can be a profile id or an
-- id from the HR name list, which has no account and so cannot be a foreign
-- key to profiles.
alter table public.session_players
  drop column profile_id,
  add column person_id text;

comment on column public.session_players.person_id is
  'Profile id or HR name-list id. Null for somebody who only typed a name.';

-- Two phones cannot claim the same person in one room. This has to be a
-- database rule: two servers can take two joins at the same moment.
create unique index session_players_person_idx
  on public.session_players (session_id, person_id)
  where person_id is not null;
