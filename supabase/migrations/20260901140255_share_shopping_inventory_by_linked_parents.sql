-- Einkaufsliste und Vorräte gehören zum Eltern-Haushalt, nicht zu einem Baby.
--
-- Bestehende Zeilen behalten baby_id als historischen Kontext. Neue App-Versionen
-- schreiben dort NULL; bei Verbrauchsbuchungen darf baby_id weiterhin angeben,
-- für welches Baby der gemeinsame Vorrat verwendet wurde.

alter table public.shopping_list_items
  drop constraint if exists shopping_list_items_baby_id_fkey;
alter table public.shopping_list_items
  alter column baby_id drop not null;
alter table public.shopping_list_items
  add constraint shopping_list_items_baby_id_fkey
  foreign key (baby_id) references public.baby_info(id) on delete set null;

alter table public.inventory_items
  drop constraint if exists inventory_items_baby_id_fkey;
alter table public.inventory_items
  alter column baby_id drop not null;
alter table public.inventory_items
  add constraint inventory_items_baby_id_fkey
  foreign key (baby_id) references public.baby_info(id) on delete set null;

alter table public.inventory_transactions
  drop constraint if exists inventory_transactions_baby_id_fkey;
alter table public.inventory_transactions
  alter column baby_id drop not null;
alter table public.inventory_transactions
  add constraint inventory_transactions_baby_id_fkey
  foreign key (baby_id) references public.baby_info(id) on delete set null;

-- Die bisherigen baby_id-Indizes spiegeln den alten Mandanten-Scope wider.
drop index if exists public.idx_shopping_list_items_baby_id;
drop index if exists public.idx_shopping_list_items_normalized;
drop index if exists public.idx_inventory_items_baby_id;
drop index if exists public.idx_inventory_items_baby_barcode;
drop index if exists public.idx_inventory_transactions_baby_id;

-- created_by bleibt der stabile Dateneigentümer. RLS erweitert den Zugriff auf
-- eine direkt und als Partner akzeptierte account_links-Verknüpfung.
create index if not exists idx_shopping_list_items_owner_state_created
  on public.shopping_list_items(created_by, is_purchased, created_at desc);
create index if not exists idx_shopping_list_items_owner_normalized_state
  on public.shopping_list_items(created_by, normalized_name, is_purchased);
create index if not exists idx_inventory_items_owner_name
  on public.inventory_items(created_by, name);
create index if not exists idx_inventory_items_barcode
  on public.inventory_items(barcode)
  where barcode is not null;
create index if not exists idx_inventory_transactions_creator_created
  on public.inventory_transactions(created_by, created_at desc);
create index if not exists idx_account_links_accepted_partner_creator_invited
  on public.account_links(creator_id, invited_id)
  where status = 'accepted' and relationship_type = 'partner';
create index if not exists idx_account_links_accepted_partner_invited_creator
  on public.account_links(invited_id, creator_id)
  where status = 'accepted' and relationship_type = 'partner';

-- Eigentum darf beim Bearbeiten eines gemeinsam sichtbaren Eintrags nicht auf
-- ein anderes Konto verschoben werden.
create or replace function public.preserve_shopping_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_shopping_list_item_created_by
  on public.shopping_list_items;
create trigger preserve_shopping_list_item_created_by
  before update on public.shopping_list_items
  for each row execute function public.preserve_shopping_created_by();

drop trigger if exists preserve_inventory_item_created_by
  on public.inventory_items;
create trigger preserve_inventory_item_created_by
  before update on public.inventory_items
  for each row execute function public.preserve_shopping_created_by();

-- Einkaufsliste: Eigentümer und direkt verknüpfte Partner sehen und bearbeiten
-- dieselben Zeilen, unabhängig vom aktiven Baby.
drop policy if exists "Shopping items: select by baby member"
  on public.shopping_list_items;
drop policy if exists "Shopping items: insert by baby member"
  on public.shopping_list_items;
drop policy if exists "Shopping items: update by baby member"
  on public.shopping_list_items;
drop policy if exists "Shopping items: delete by baby member"
  on public.shopping_list_items;

create policy "Shopping items: select by linked parents"
  on public.shopping_list_items
  for select
  to authenticated
  using (
    (select auth.uid()) = created_by
    or exists (
      select 1
      from public.account_links al
      where al.status = 'accepted'
        and al.relationship_type = 'partner'
        and (
          (al.creator_id = (select auth.uid()) and al.invited_id = shopping_list_items.created_by)
          or
          (al.invited_id = (select auth.uid()) and al.creator_id = shopping_list_items.created_by)
        )
    )
  );

create policy "Shopping items: insert by owner"
  on public.shopping_list_items
  for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and (baby_id is null or public.is_baby_member(baby_id))
  );

create policy "Shopping items: update by linked parents"
  on public.shopping_list_items
  for update
  to authenticated
  using (
    (select auth.uid()) = created_by
    or exists (
      select 1
      from public.account_links al
      where al.status = 'accepted'
        and al.relationship_type = 'partner'
        and (
          (al.creator_id = (select auth.uid()) and al.invited_id = shopping_list_items.created_by)
          or
          (al.invited_id = (select auth.uid()) and al.creator_id = shopping_list_items.created_by)
        )
    )
  )
  with check (
    (
      (select auth.uid()) = created_by
      or exists (
        select 1
        from public.account_links al
        where al.status = 'accepted'
          and al.relationship_type = 'partner'
          and (
            (al.creator_id = (select auth.uid()) and al.invited_id = shopping_list_items.created_by)
            or
            (al.invited_id = (select auth.uid()) and al.creator_id = shopping_list_items.created_by)
          )
      )
    )
    and (baby_id is null or public.is_baby_member(baby_id))
  );

create policy "Shopping items: delete by linked parents"
  on public.shopping_list_items
  for delete
  to authenticated
  using (
    (select auth.uid()) = created_by
    or exists (
      select 1
      from public.account_links al
      where al.status = 'accepted'
        and al.relationship_type = 'partner'
        and (
          (al.creator_id = (select auth.uid()) and al.invited_id = shopping_list_items.created_by)
          or
          (al.invited_id = (select auth.uid()) and al.creator_id = shopping_list_items.created_by)
        )
    )
  );

-- Vorräte: derselbe Eltern-Scope wie bei der Einkaufsliste.
drop policy if exists "Inventory items: select by baby member"
  on public.inventory_items;
drop policy if exists "Inventory items: insert by baby member"
  on public.inventory_items;
drop policy if exists "Inventory items: update by baby member"
  on public.inventory_items;
drop policy if exists "Inventory items: delete by baby member"
  on public.inventory_items;

create policy "Inventory items: select by linked parents"
  on public.inventory_items
  for select
  to authenticated
  using (
    (select auth.uid()) = created_by
    or exists (
      select 1
      from public.account_links al
      where al.status = 'accepted'
        and al.relationship_type = 'partner'
        and (
          (al.creator_id = (select auth.uid()) and al.invited_id = inventory_items.created_by)
          or
          (al.invited_id = (select auth.uid()) and al.creator_id = inventory_items.created_by)
        )
    )
  );

create policy "Inventory items: insert by owner"
  on public.inventory_items
  for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and (baby_id is null or public.is_baby_member(baby_id))
  );

create policy "Inventory items: update by linked parents"
  on public.inventory_items
  for update
  to authenticated
  using (
    (select auth.uid()) = created_by
    or exists (
      select 1
      from public.account_links al
      where al.status = 'accepted'
        and al.relationship_type = 'partner'
        and (
          (al.creator_id = (select auth.uid()) and al.invited_id = inventory_items.created_by)
          or
          (al.invited_id = (select auth.uid()) and al.creator_id = inventory_items.created_by)
        )
    )
  )
  with check (
    (
      (select auth.uid()) = created_by
      or exists (
        select 1
        from public.account_links al
        where al.status = 'accepted'
          and al.relationship_type = 'partner'
          and (
            (al.creator_id = (select auth.uid()) and al.invited_id = inventory_items.created_by)
            or
            (al.invited_id = (select auth.uid()) and al.creator_id = inventory_items.created_by)
          )
      )
    )
    and (baby_id is null or public.is_baby_member(baby_id))
  );

create policy "Inventory items: delete by linked parents"
  on public.inventory_items
  for delete
  to authenticated
  using (
    (select auth.uid()) = created_by
    or exists (
      select 1
      from public.account_links al
      where al.status = 'accepted'
        and al.relationship_type = 'partner'
        and (
          (al.creator_id = (select auth.uid()) and al.invited_id = inventory_items.created_by)
          or
          (al.invited_id = (select auth.uid()) and al.creator_id = inventory_items.created_by)
        )
    )
  );

-- Transaktionen folgen dem Eigentümer ihres Vorratspostens. Dadurch bleibt das
-- Audit-Log beim Vorrat, auch wenn der andere Elternteil die Buchung ausführt.
drop policy if exists "Inventory transactions: select by baby member"
  on public.inventory_transactions;
drop policy if exists "Inventory transactions: insert by baby member"
  on public.inventory_transactions;

create policy "Inventory transactions: select by linked parents"
  on public.inventory_transactions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.inventory_items ii
      where ii.id = inventory_transactions.inventory_item_id
        and (
          (select auth.uid()) = ii.created_by
          or exists (
            select 1
            from public.account_links al
            where al.status = 'accepted'
              and al.relationship_type = 'partner'
              and (
                (al.creator_id = (select auth.uid()) and al.invited_id = ii.created_by)
                or
                (al.invited_id = (select auth.uid()) and al.creator_id = ii.created_by)
              )
          )
        )
    )
  );

create policy "Inventory transactions: insert by linked parents"
  on public.inventory_transactions
  for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and (baby_id is null or public.is_baby_member(baby_id))
    and exists (
      select 1
      from public.inventory_items ii
      where ii.id = inventory_transactions.inventory_item_id
        and (
          (select auth.uid()) = ii.created_by
          or exists (
            select 1
            from public.account_links al
            where al.status = 'accepted'
              and al.relationship_type = 'partner'
              and (
                (al.creator_id = (select auth.uid()) and al.invited_id = ii.created_by)
                or
                (al.invited_id = (select auth.uid()) and al.creator_id = ii.created_by)
              )
          )
        )
    )
  );
