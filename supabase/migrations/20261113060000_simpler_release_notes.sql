-- The release note template is now four short lines per feature, written for
-- staff who just need to know what is coming:
--
--   What's new:   the one-sentence headline
--   You'll see:   what they will notice on screen  <-- new
--   Instead of:   the old way, used as a wrong answer
--   Remember:     the one thing not to get wrong
--
-- "You'll see" needs somewhere to live, and the generator now also builds
-- "where do you see it" and true/false questions.

alter table public.features
  add column you_see text;

comment on column public.features.you_see is
  'What the person will actually see on screen. "You''ll see:" in the release note.';

alter table public.questions
  drop constraint if exists questions_kind_check;

alter table public.questions
  add constraint questions_kind_check
  check (kind in ('behaviour', 'whereToSee', 'misconception', 'trueFalse',
                  'limit', 'step', 'mustKnow', 'custom'));
