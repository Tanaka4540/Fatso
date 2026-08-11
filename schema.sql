-- Soulmates production MVP schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  age int not null check (age >= 18),
  bio text,
  city text,
  gender text,
  photo_url text,
  interests text[] default '{}',
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(from_user,to_user),
  check(from_user <> to_user)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_a,user_b),
  check(user_a <> user_b)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check(length(body) <= 2000),
  created_at timestamptz default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key(blocker_id,blocked_id)
);

alter table public.profiles enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

create policy "profiles readable to signed in users" on public.profiles for select to authenticated using (true);
create policy "users create own profile" on public.profiles for insert to authenticated with check (auth.uid()=id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid()=id);

create policy "users create own likes" on public.likes for insert to authenticated with check (auth.uid()=from_user);
create policy "users read own likes" on public.likes for select to authenticated using (auth.uid()=from_user or auth.uid()=to_user);

create policy "users read own matches" on public.matches for select to authenticated using (auth.uid()=user_a or auth.uid()=user_b);

create policy "participants read messages" on public.messages for select to authenticated using (
  exists(select 1 from public.matches m where m.id=match_id and (m.user_a=auth.uid() or m.user_b=auth.uid()))
);
create policy "participants send messages" on public.messages for insert to authenticated with check (
  auth.uid()=sender_id and exists(select 1 from public.matches m where m.id=match_id and (m.user_a=auth.uid() or m.user_b=auth.uid()))
);

create policy "users submit reports" on public.reports for insert to authenticated with check (auth.uid()=reporter_id);
create policy "users manage own blocks" on public.blocks for all to authenticated using (auth.uid()=blocker_id) with check (auth.uid()=blocker_id);

-- Automatically create a match when two users like each other.
create or replace function public.create_match_on_like()
returns trigger language plpgsql security definer as $$
declare a uuid; b uuid;
begin
  if exists(select 1 from public.likes where from_user=NEW.to_user and to_user=NEW.from_user) then
    a := least(NEW.from_user,NEW.to_user);
    b := greatest(NEW.from_user,NEW.to_user);
    insert into public.matches(user_a,user_b) values(a,b) on conflict do nothing;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_match_on_like on public.likes;
create trigger trg_match_on_like after insert on public.likes
for each row execute function public.create_match_on_like();

alter publication supabase_realtime add table public.messages;
