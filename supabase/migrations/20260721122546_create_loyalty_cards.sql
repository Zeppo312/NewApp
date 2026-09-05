create table if not exists public.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  barcode text not null check (char_length(barcode) between 1 and 128),
  scanned_type text not null default 'manual' check (char_length(scanned_type) between 1 and 32),
  color text not null default '#8E4EC6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

create index if not exists loyalty_cards_user_created_idx
  on public.loyalty_cards (user_id, created_at desc);

alter table public.loyalty_cards enable row level security;

revoke all on table public.loyalty_cards from anon, authenticated;
grant select, insert, delete on table public.loyalty_cards to authenticated;

drop policy if exists "Users can read their own loyalty cards" on public.loyalty_cards;
create policy "Users can read their own loyalty cards"
  on public.loyalty_cards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own loyalty cards" on public.loyalty_cards;
create policy "Users can create their own loyalty cards"
  on public.loyalty_cards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own loyalty cards" on public.loyalty_cards;
create policy "Users can delete their own loyalty cards"
  on public.loyalty_cards
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
