create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  role text default 'client',
  offer text,
  instagram_handle text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references profiles(id) on delete cascade,
  name text not null,
  type text not null,
  file_url text,
  created_at timestamptz default now()
);

create table if not exists content_items (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text,
  status text default 'pending',
  feedback text,
  files jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists client_uploads (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references profiles(id) on delete cascade,
  name text,
  file_url text,
  file_type text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table documents enable row level security;
alter table content_items enable row level security;
alter table client_uploads enable row level security;

create policy "own_profile" on profiles for select using (auth.uid() = id);
create policy "admin_all_profiles" on profiles for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "update_own_profile" on profiles for update using (auth.uid() = id);

create policy "own_docs" on documents for select using (client_id = auth.uid());
create policy "admin_all_docs" on documents for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "own_content" on content_items for select using (client_id = auth.uid());
create policy "update_own_content" on content_items for update using (client_id = auth.uid());
create policy "admin_all_content" on content_items for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "own_uploads" on client_uploads for select using (client_id = auth.uid());
create policy "insert_own_uploads" on client_uploads for insert with check (client_id = auth.uid());
create policy "admin_all_uploads" on client_uploads for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create table if not exists client_notes (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references profiles(id) on delete cascade,
  note text not null,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references profiles(id) on delete cascade,
  title text not null,
  done boolean default false,
  created_at timestamptz default now()
);

alter table client_notes enable row level security;
alter table tasks enable row level security;

create policy "own_client_notes_select" on client_notes for select using (client_id = auth.uid());
create policy "own_client_notes_insert" on client_notes for insert with check (client_id = auth.uid());
create policy "admin_all_client_notes" on client_notes for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "own_tasks_select" on tasks for select using (client_id = auth.uid());
create policy "own_tasks_insert" on tasks for insert with check (client_id = auth.uid());
create policy "own_tasks_update" on tasks for update using (client_id = auth.uid());
create policy "own_tasks_delete" on tasks for delete using (client_id = auth.uid());
create policy "admin_all_tasks" on tasks for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when new.email = 'clairevigneron.contact@gmail.com' then 'admin' else 'client' end
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Colonne pour synchroniser les notifications dismissées entre appareils
alter table profiles add column if not exists dismissed_notifs jsonb default '[]'::jsonb;
