-- Most people in the room are not going to use a feature every day; they only
-- need to know it exists and who it helps. Two things follow from that:
--
--   * a feature can say who it helps, in its own words
--   * "whoItHelps" becomes a question kind: the answer a colleague or a
--     customer actually asks for

alter table public.features
  add column if not exists who_it_helps text;

alter table public.questions
  drop constraint if exists questions_kind_check;

alter table public.questions
  add constraint questions_kind_check
  check (kind in ('behaviour', 'whereToSee', 'whoItHelps', 'misconception',
                  'trueFalse', 'stepOrder', 'firstStep', 'nextStep',
                  'limit', 'step', 'mustKnow', 'custom'));
