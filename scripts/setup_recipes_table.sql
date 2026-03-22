-- -----------------------------------------------------------------------------
-- Script: setup_recipes_table.sql
-- Purpose: Create the Supabase table, policies, and storage bucket required
--          for the BLW recipe catalogue inside the LottiBaby app.
-- Usage : Run inside the Supabase SQL editor or with `supabase db query`.
-- -----------------------------------------------------------------------------

begin;

-- Create table for recipes (idempotent).
create table if not exists public.baby_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  min_months smallint not null check (min_months >= 4),
  ingredients text[] not null default '{}'::text[],
  allergens text[] not null default '{}'::text[],
  instructions text not null,
  tip text,
  image_url text,
  is_global boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful indexes for lookups and ingredient filtering.
create unique index if not exists baby_recipes_title_idx
  on public.baby_recipes (lower(title));

create index if not exists baby_recipes_min_months_idx
  on public.baby_recipes (min_months);

create index if not exists baby_recipes_ingredients_gin_idx
  on public.baby_recipes using gin (ingredients);

create index if not exists baby_recipes_allergens_gin_idx
  on public.baby_recipes using gin (allergens);

-- Ensure updated_at is refreshed on changes (reuses shared helper if present).
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_updated_at_on_baby_recipes'
  ) then
    create trigger set_updated_at_on_baby_recipes
      before update on public.baby_recipes
      for each row
      execute function public.set_updated_at();
  end if;
end $$;

alter table public.baby_recipes enable row level security;

-- Allow only visible recipes (global, own, or partner-linked).
drop policy if exists "Allow anyone to read recipes" on public.baby_recipes;
drop policy if exists "Allow visible recipes" on public.baby_recipes;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'baby_recipes'
      and policyname = 'Allow visible recipes'
  ) then
    create policy "Allow visible recipes"
      on public.baby_recipes
      for select
      using (
        is_global = true
        or auth.uid() = user_id
        or exists (
          select 1
          from public.account_links links
          where links.status = 'accepted'
            and links.relationship_type = 'partner'
            and (
              (links.creator_id = auth.uid() and links.invited_id = baby_recipes.user_id)
              or (links.invited_id = auth.uid() and links.creator_id = baby_recipes.user_id)
            )
        )
      );
  end if;
end $$;

-- Authenticated users can create their own recipes (admins may mark global).
drop policy if exists "Allow authenticated users to insert recipes" on public.baby_recipes;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'baby_recipes'
      and policyname = 'Allow authenticated users to insert recipes'
  ) then
    create policy "Allow authenticated users to insert recipes"
      on public.baby_recipes
      for insert
      with check (
        auth.uid() = user_id
        and (
          is_global = false
          or exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and is_admin = true
          )
        )
      );
  end if;
end $$;

-- Users may update/delete recipes they created (admins may keep global).
drop policy if exists "Allow owners to update recipes" on public.baby_recipes;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'baby_recipes'
      and policyname = 'Allow owners to update recipes'
  ) then
    create policy "Allow owners to update recipes"
      on public.baby_recipes
      for update
      using (auth.uid() = user_id)
      with check (
        auth.uid() = user_id
        and (
          is_global = false
          or exists (
            select 1
            from public.profiles
            where id = auth.uid()
              and is_admin = true
          )
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'baby_recipes'
      and policyname = 'Allow owners to delete recipes'
  ) then
    create policy "Allow owners to delete recipes"
      on public.baby_recipes
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Storage bucket for recipe imagery (public read, authenticated write).
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from storage.buckets where name = 'recipe-images'
  ) then
    insert into storage.buckets (id, name, public)
    values ('recipe-images', 'recipe-images', true);
  end if;
end $$;

-- Public read access for the recipe images bucket.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public read on recipe images'
  ) then
    create policy "Allow public read on recipe images"
      on storage.objects
      for select
      using (bucket_id = 'recipe-images');
  end if;
end $$;

-- Authenticated users can upload images into the recipe bucket.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow authenticated upload for recipe images'
  ) then
    create policy "Allow authenticated upload for recipe images"
      on storage.objects
      for insert
      with check (
        bucket_id = 'recipe-images'
        and auth.role() = 'authenticated'
      );
  end if;
end $$;

-- Authenticated users can manage (update/delete) their own uploaded recipe images.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow owners to manage recipe images'
  ) then
    create policy "Allow owners to manage recipe images"
      on storage.objects
      for update using (bucket_id = 'recipe-images' and auth.uid() = owner)
      with check (bucket_id = 'recipe-images' and auth.uid() = owner);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow owners to delete recipe images'
  ) then
    create policy "Allow owners to delete recipe images"
      on storage.objects
      for delete using (bucket_id = 'recipe-images' and auth.uid() = owner);
  end if;
end $$;

commit;
