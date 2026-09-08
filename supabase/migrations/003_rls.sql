alter table public.profiles enable row level security;
alter table public.user_words enable row level security;
alter table public.user_meanings enable row level security;
alter table public.meaning_review_states enable row level security;
alter table public.review_records enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_logs enable row level security;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "user_words_select_own"
  on public.user_words for select to authenticated
  using (auth.uid() = user_id);

create policy "user_words_insert_own"
  on public.user_words for insert to authenticated
  with check (auth.uid() = user_id);

create policy "user_words_update_own"
  on public.user_words for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_words_delete_own"
  on public.user_words for delete to authenticated
  using (auth.uid() = user_id);

create policy "user_meanings_select_own"
  on public.user_meanings for select to authenticated
  using (auth.uid() = user_id);

create policy "user_meanings_insert_own"
  on public.user_meanings for insert to authenticated
  with check (auth.uid() = user_id);

create policy "user_meanings_update_own"
  on public.user_meanings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_meanings_delete_own"
  on public.user_meanings for delete to authenticated
  using (auth.uid() = user_id);

create policy "meaning_review_states_select_own"
  on public.meaning_review_states for select to authenticated
  using (auth.uid() = user_id);

create policy "meaning_review_states_insert_own"
  on public.meaning_review_states for insert to authenticated
  with check (auth.uid() = user_id);

create policy "meaning_review_states_update_own"
  on public.meaning_review_states for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "meaning_review_states_delete_own"
  on public.meaning_review_states for delete to authenticated
  using (auth.uid() = user_id);

create policy "review_records_select_own"
  on public.review_records for select to authenticated
  using (auth.uid() = user_id);

create policy "review_records_insert_own"
  on public.review_records for insert to authenticated
  with check (auth.uid() = user_id);

create policy "review_records_update_own"
  on public.review_records for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "review_records_delete_own"
  on public.review_records for delete to authenticated
  using (auth.uid() = user_id);

create policy "push_subscriptions_manage_own"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notification_logs_select_own"
  on public.notification_logs for select to authenticated
  using (auth.uid() = user_id);

create policy "notification_logs_insert_own"
  on public.notification_logs for insert to authenticated
  with check (auth.uid() = user_id);
