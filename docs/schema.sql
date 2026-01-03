-- ==========================================
-- 1. Create PROFILES table
-- Links to built-in auth.users table
-- ==========================================
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  
  primary key (id)
);

-- Enable RLS (Row Level Security)
alter table public.profiles enable row level security;

-- Policy: Users can view their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using ( auth.uid() = id );

-- Policy: Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- ==========================================
-- 2. Create USER_DATA table
-- Stores the large JSON object for app state
-- ==========================================
create table public.user_data (
  user_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  last_synced_at timestamp with time zone default timezone('utc'::text, now()),
  
  primary key (user_id)
);

-- Enable RLS
alter table public.user_data enable row level security;

-- Policy: Users can CRUD their own data
create policy "Users can all own data"
  on public.user_data for all
  using ( auth.uid() = user_id );


-- ==========================================
-- 3. Auto-Create Profile on Signup (Trigger)
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url'
  );
  
  -- Also initialize empty user_data
  insert into public.user_data (user_id, data)
  values (new.id, '{}'::jsonb);
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- INSTRUCTIONS:
-- 1. Go to Supabase > SQL Editor.
-- 2. Copy/Paste this entire file.
-- 3. Click "Run".
-- ==========================================
