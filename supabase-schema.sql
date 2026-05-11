-- Run this in Supabase Dashboard → SQL Editor

-- User profiles (linked to Supabase Auth)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Admin online status
create table if not exists admin_status (
  id int primary key default 1,
  is_online boolean default false,
  last_seen timestamptz default now()
);
insert into admin_status (id, is_online) values (1, false) on conflict do nothing;

-- Conversations (one per user)
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  user_name text not null,
  user_email text not null,
  status text default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations on delete cascade,
  sender_type text not null, -- 'user' | 'admin' | 'bot'
  content text not null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table admin_status enable row level security;

-- Profiles: users can read/update their own
create policy "users read own profile" on profiles for select using (auth.uid() = id);
create policy "users update own profile" on profiles for update using (auth.uid() = id);
create policy "service role full access profiles" on profiles using (true) with check (true);

-- Conversations: users see their own; service role sees all
create policy "users see own conversations" on conversations for select using (auth.uid() = user_id);
create policy "users create own conversations" on conversations for insert with check (auth.uid() = user_id);
create policy "service role full access conversations" on conversations using (true) with check (true);

-- Messages: users see messages in their conversations
create policy "users see own messages" on messages for select
  using (exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "users insert own messages" on messages for insert
  with check (exists (select 1 from conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "service role full access messages" on messages using (true) with check (true);

-- Admin status: anyone can read
create policy "anyone read admin status" on admin_status for select using (true);
create policy "service role update admin status" on admin_status using (true) with check (true);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'User'), new.email);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
