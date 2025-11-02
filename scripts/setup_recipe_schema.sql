-- Supabase Setup Script for the BLW Recipe Generator
-- Erstellt Tabelle, Policies, Bucket und Demo-Daten für Rezepte

-- Voraussetzung für gen_random_uuid
create extension if not exists "pgcrypto";

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid references auth.users (id),
  title text not null,
  description text,
  min_months int not null default 6,
  ingredients text[] not null default '{}',
  allergens text[] not null default '{}',
  instructions text not null,
  image_url text
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

alter table public.recipes enable row level security;

drop policy if exists "Recipes are viewable by everyone" on public.recipes;
create policy "Recipes are viewable by everyone"
  on public.recipes for select
  using (true);

drop policy if exists "Authenticated users can insert recipes" on public.recipes;
create policy "Authenticated users can insert recipes"
  on public.recipes for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

drop policy if exists "Authors can update their recipes" on public.recipes;
create policy "Authors can update their recipes"
  on public.recipes for update
  using ((auth.uid() = created_by) or auth.role() = 'service_role')
  with check ((auth.uid() = created_by) or auth.role() = 'service_role');

drop policy if exists "Authors can delete their recipes" on public.recipes;
create policy "Authors can delete their recipes"
  on public.recipes for delete
  using ((auth.uid() = created_by) or auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

-- Storage Policies für das Bucket
create policy if not exists "Public recipe image read access"
  on storage.objects for select
  using (bucket_id = 'recipe-images');

create policy if not exists "Authenticated users can upload recipe images"
  on storage.objects for insert
  with check (bucket_id = 'recipe-images' and auth.role() = 'authenticated');

create policy if not exists "Owners can update recipe images"
  on storage.objects for update
  using (bucket_id = 'recipe-images' and auth.uid() = owner)
  with check (bucket_id = 'recipe-images' and auth.uid() = owner);

create policy if not exists "Owners can remove recipe images"
  on storage.objects for delete
  using (bucket_id = 'recipe-images' and auth.uid() = owner);

-- Demo-Daten: Nur einfügen, wenn der Titel noch nicht existiert
insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Süßkartoffel-Linsen-Eintopf',
  'Cremiger Eintopf mit milden Gewürzen – perfekt für gemeinsame Familienabende.',
  8,
  array['Süßkartoffel', 'rote Linsen', 'Karotte', 'Kokosmilch', 'Rapsöl'],
  array[]::text[],
  E'1. Süßkartoffel und Karotte würfeln.\n2. Zusammen mit Linsen und Kokosmilch weich köcheln.\n3. Mit etwas Rapsöl abschmecken und für kleine Hände leicht zerdrücken.',
  null
where not exists (select 1 from public.recipes where title = 'Süßkartoffel-Linsen-Eintopf');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Apfel-Zimt-Porridge',
  'Wärmender Frühstücksbrei mit extra weichen Apfelstücken.',
  6,
  array['Haferflocken', 'Apfel', 'Zimt', 'Wasser', 'Naturjoghurt'],
  array['gluten', 'milk'],
  E'1. Haferflocken mit Wasser cremig kochen.\n2. Fein gewürfelten Apfel und Zimt unterheben.\n3. Mit einem Klecks Joghurt servieren.',
  null
where not exists (select 1 from public.recipes where title = 'Apfel-Zimt-Porridge');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Brokkoli-Quinoa-Bällchen',
  'Fingerfood-Bällchen mit Gemüse und Protein – super zum Selbergreifen.',
  10,
  array['Brokkoli', 'Quinoa', 'Ei', 'Parmesan', 'Petersilie'],
  array['egg', 'milk'],
  E'1. Brokkoli dämpfen und fein hacken.\n2. Mit gegarter Quinoa, Ei und Parmesan vermischen.\n3. Kleine Bällchen formen und im Ofen backen.',
  null
where not exists (select 1 from public.recipes where title = 'Brokkoli-Quinoa-Bällchen');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Avocado-Erbsen-Creme',
  'Schneller Dip für Brotsticks oder Gemüsefinger.',
  6,
  array['Avocado', 'Erbsen', 'Limette', 'Petersilie'],
  array[]::text[],
  E'1. Erbsen weich dämpfen und abkühlen lassen.\n2. Mit Avocado und Limettensaft pürieren.\n3. Mit Petersilie verfeinern und sofort servieren.',
  null
where not exists (select 1 from public.recipes where title = 'Avocado-Erbsen-Creme');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Bananen-Hafer-Muffins',
  'Saftige Mini-Muffins ohne zusätzlichen Zucker.',
  9,
  array['Banane', 'Haferflocken', 'Ei', 'Backpulver', 'Zimt'],
  array['gluten', 'egg'],
  E'1. Banane zerdrücken und mit Ei verrühren.\n2. Haferflocken, Backpulver und Zimt unterheben.\n3. In Muffinformen füllen und ca. 15 Minuten backen.',
  null
where not exists (select 1 from public.recipes where title = 'Bananen-Hafer-Muffins');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Kokos-Mango-Reis',
  'Tropischer Milchreis mit fruchtiger Mango.',
  12,
  array['Reis', 'Kokosmilch', 'Mango', 'Vanille'],
  array[]::text[],
  E'1. Reis in Kokosmilch weich kochen.\n2. Mango würfeln und unterheben.\n3. Mit Vanille abschmecken und lauwarm servieren.',
  null
where not exists (select 1 from public.recipes where title = 'Kokos-Mango-Reis');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Zucchini-Kartoffel-Rösti',
  'Knusprige Rösti aus dem Ofen mit mildem Geschmack.',
  11,
  array['Zucchini', 'Kartoffel', 'Ei', 'Olivenöl', 'Petersilie'],
  array['egg'],
  E'1. Zucchini und Kartoffeln raspeln und gut ausdrücken.\n2. Mit Ei und Petersilie mischen.\n3. Flache Rösti formen und im Ofen goldbraun backen.',
  null
where not exists (select 1 from public.recipes where title = 'Zucchini-Kartoffel-Rösti');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Hähnchen-Gemüse-Pfanne',
  'Schnelle Pfanne mit zartem Hähnchen und buntem Gemüse.',
  12,
  array['Hühnchen', 'Karotte', 'Brokkoli', 'Zucchini', 'Rapsöl'],
  array[]::text[],
  E'1. Hähnchen in Streifen schneiden und anbraten.\n2. Gemüse dazugeben und weich garen.\n3. Mit etwas Wasser schmoren und lauwarm servieren.',
  null
where not exists (select 1 from public.recipes where title = 'Hähnchen-Gemüse-Pfanne');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Lachs-Spinat-Pasta',
  'Omega-3-Power kombiniert mit weicher Pasta.',
  12,
  array['Lachs', 'Spinat', 'Vollkornnudeln', 'Frischkäse', 'Zitrone'],
  array['fish', 'gluten', 'milk'],
  E'1. Nudeln weich kochen.\n2. Lachs und Spinat schonend garen.\n3. Mit Frischkäse und Zitronensaft verrühren und Nudeln unterheben.',
  null
where not exists (select 1 from public.recipes where title = 'Lachs-Spinat-Pasta');

insert into public.recipes (title, description, min_months, ingredients, allergens, instructions, image_url)
select
  'Tofu-Gemüse-Wok',
  'Vegane Pfanne mit viel Gemüse und zartem Tofu.',
  11,
  array['Tofu', 'Brokkoli', 'Paprika', 'Sesam', 'Sojasauce'],
  array['gluten', 'nuts'],
  E'1. Tofu würfeln und goldbraun anbraten.\n2. Gemüse dazugeben und bissfest garen.\n3. Mit Sojasauce und Sesam abschmecken.',
  null
where not exists (select 1 from public.recipes where title = 'Tofu-Gemüse-Wok');
