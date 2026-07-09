-- Sprach-Logging: Nutzungs-Log für serverseitiges Rate-Limiting.
-- Jeder Aufruf der Edge Function voice-log-parse schreibt hier eine Zeile;
-- die Function zählt vor der (kostenpflichtigen) OpenAI-Verarbeitung die
-- Versuche pro Nutzer und lehnt bei Überschreitung mit 429 ab.

create table if not exists public.voice_log_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists voice_log_requests_user_created_idx
  on public.voice_log_requests (user_id, created_at desc);

-- RLS ohne Policies: Clients haben keinerlei Zugriff, nur die Edge Function
-- (Service Role) liest und schreibt.
alter table public.voice_log_requests enable row level security;
