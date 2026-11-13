-- An imported release is a draft until the host has checked the questions and
-- pressed Save as template. Only ready releases show up in the library, so
-- nobody plays a quiz that is still being written.
--
-- Default is 'ready' so anything stored before this change stays visible.

alter table public.modules
  add column status text not null default 'ready'
  check (status in ('draft', 'ready'));

comment on column public.modules.status is
  'draft = still being edited by its owner. ready = in the library and playable.';

create index modules_status_idx on public.modules (status, created_at desc);
