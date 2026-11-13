-- Staff need to know whether they could actually do the job end to end, not
-- only recognise the feature name. A "Steps:" line in the release note now
-- becomes three kinds of question about the flow:
--
--   stepOrder  the whole cycle in the right order
--   firstStep  where the job starts
--   nextStep   what happens straight after one step

alter table public.questions
  drop constraint if exists questions_kind_check;

alter table public.questions
  add constraint questions_kind_check
  check (kind in ('behaviour', 'whereToSee', 'misconception', 'trueFalse',
                  'stepOrder', 'firstStep', 'nextStep',
                  'limit', 'step', 'mustKnow', 'custom'));
