-- Kundenkarten werden innerhalb einer akzeptierten Partner-Verknüpfung geteilt.
-- Die Eigentümerschaft bleibt unverändert in loyalty_cards.user_id; Partner
-- erhalten nur Zugriff, solange der Account-Link akzeptiert und vom Typ partner ist.

drop policy if exists "Users can read their own loyalty cards" on public.loyalty_cards;
drop policy if exists "Users and partners can read loyalty cards" on public.loyalty_cards;
create policy "Users and partners can read loyalty cards"
  on public.loyalty_cards
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.account_links al
      where al.status = 'accepted'
        and al.relationship_type = 'partner'
        and (
          (al.creator_id = (select auth.uid()) and al.invited_id = loyalty_cards.user_id)
          or
          (al.invited_id = (select auth.uid()) and al.creator_id = loyalty_cards.user_id)
        )
    )
  );

drop policy if exists "Users can delete their own loyalty cards" on public.loyalty_cards;
drop policy if exists "Users and partners can delete loyalty cards" on public.loyalty_cards;
create policy "Users and partners can delete loyalty cards"
  on public.loyalty_cards
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.account_links al
      where al.status = 'accepted'
        and al.relationship_type = 'partner'
        and (
          (al.creator_id = (select auth.uid()) and al.invited_id = loyalty_cards.user_id)
          or
          (al.invited_id = (select auth.uid()) and al.creator_id = loyalty_cards.user_id)
        )
    )
  );
