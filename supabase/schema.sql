create extension if not exists pgcrypto;

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  start_time timestamptz not null,
  end_time timestamptz,
  event text not null,
  description text,
  link text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_entries_start_time_idx
  on public.time_entries (start_time desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_time_entries_updated_at on public.time_entries;

create trigger set_time_entries_updated_at
before update on public.time_entries
for each row
execute function public.set_updated_at();

alter table public.time_entries enable row level security;

drop policy if exists "service role can manage time entries" on public.time_entries;

create policy "service role can manage time entries"
on public.time_entries
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
values ('time-tracker-photos', 'time-tracker-photos', true)
on conflict (id) do update set public = true;
