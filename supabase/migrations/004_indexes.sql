create index if not exists user_words_user_id_idx on public.user_words (user_id);
create index if not exists user_words_normalized_word_idx on public.user_words (normalized_word);
create index if not exists user_words_updated_at_idx on public.user_words (updated_at);

create index if not exists user_meanings_user_id_idx on public.user_meanings (user_id);
create index if not exists user_meanings_word_id_idx on public.user_meanings (word_id);

create index if not exists meaning_review_states_user_due_idx
  on public.meaning_review_states (user_id, due_at);

create index if not exists review_records_user_reviewed_idx
  on public.review_records (user_id, reviewed_at);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
