-- pgvector for semantic search (gte-small = 384 dimensions)
create extension if not exists vector with schema extensions;

-- Dialogs: one per user conversation
create table public.dialogs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Новый диалог',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dialogs enable row level security;

create policy "Users can manage own dialogs"
  on public.dialogs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_dialogs_user_updated on public.dialogs (user_id, updated_at desc);

-- Messages: chat history per dialog
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  dialog_id uuid not null references public.dialogs(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb default null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can manage messages in own dialogs"
  on public.messages for all
  using (
    exists (
      select 1 from public.dialogs d
      where d.id = messages.dialog_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.dialogs d
      where d.id = messages.dialog_id and d.user_id = auth.uid()
    )
  );

create index idx_messages_dialog on public.messages (dialog_id, created_at);

-- Case chunks: RAG documents with embeddings (gte-small 384)
create table public.case_chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding extensions.vector(384),
  case_number text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

alter table public.case_chunks enable row level security;

-- case_chunks: no direct read for users; access only via match_case_chunks RPC
create policy "No direct access"
  on public.case_chunks for select
  using (false);

create index on public.case_chunks using hnsw (embedding vector_ip_ops);

-- Vector similarity search: returns top-K chunks (normalized embeddings → inner product)
-- SECURITY DEFINER so it runs with owner rights and can read case_chunks
create or replace function public.match_case_chunks(
  query_embedding extensions.vector(384),
  match_threshold float default 0.5,
  match_count int default 6
)
returns setof public.case_chunks
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.case_chunks
  where embedding is not null
    and (embedding <#> query_embedding) < -match_threshold
  order by embedding <#> query_embedding
  limit least(match_count, 20);
$$;

-- Allow authenticated users to call the search function
grant execute on function public.match_case_chunks(extensions.vector(384), float, int) to authenticated;
grant execute on function public.match_case_chunks(extensions.vector(384), float, int) to service_role;

-- Realtime: enable for dialogs and messages
alter publication supabase_realtime add table public.dialogs;
alter publication supabase_realtime add table public.messages;
