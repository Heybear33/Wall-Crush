create table if not exists public.runners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  ten_k_record text,
  half_record text,
  full_record text,
  goal_race text,
  goal_record text,
  injured boolean not null default false,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  runner_id uuid not null references public.runners(id) on delete cascade,
  checked_at date not null,
  day_type text not null check (day_type in ('tue', 'thu')),
  created_at timestamptz not null default now(),
  unique (runner_id, checked_at, day_type)
);

create table if not exists public.races (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  race_date date,
  -- 아래 컬럼은 기존 운영 데이터 호환용입니다. 현재 앱 화면에서는 대회명, 날짜, 장소만 사용합니다.
  distance text not null default '10km',
  location text,
  target_record text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.admins (email)
values ('rdragonw@gmail.com')
on conflict (email) do nothing;

alter table public.runners enable row level security;
alter table public.attendances enable row level security;
alter table public.races enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admins
    where lower(admins.email) = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins can view own admin status" on public.admins;
create policy "admins can view own admin status"
on public.admins for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "members can view own runner profile" on public.runners;
create policy "members can view own runner profile"
on public.runners for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "admins can manage runners" on public.runners;
create policy "admins can manage runners"
on public.runners for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "members can view own attendance" on public.attendances;
create policy "members can view own attendance"
on public.attendances for select
to authenticated
using (
  exists (
    select 1
    from public.runners
    where runners.id = attendances.runner_id
      and lower(runners.email) = lower(auth.jwt() ->> 'email')
  )
);

drop policy if exists "admins can manage attendance" on public.attendances;
create policy "admins can manage attendance"
on public.attendances for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated users can view races" on public.races;
create policy "authenticated users can view races"
on public.races for select
to authenticated
using (true);

drop policy if exists "admins can manage races" on public.races;
create policy "admins can manage races"
on public.races for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
