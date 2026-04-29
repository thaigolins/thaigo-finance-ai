-- Enums
do $$ begin
  create type public.import_doc_kind as enum ('extrato', 'fatura', 'fgts', 'emprestimo', 'contracheque', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_method as enum ('pdf_text', 'pdf_ocr', 'image_ai', 'csv_parser', 'ofx_parser', 'ai_fallback');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_session_status as enum ('extracting', 'review', 'confirmed', 'discarded', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_staging_status as enum ('pending', 'confirmed', 'discarded', 'duplicate');
exception when duplicate_object then null; end $$;

-- Sessions table
create table if not exists public.import_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  doc_kind public.import_doc_kind not null default 'extrato',
  method public.import_method,
  status public.import_session_status not null default 'extracting',
  source_file_id uuid references public.uploaded_files(id) on delete set null,
  conversation_id uuid,
  message_id uuid,
  pending_action_id uuid references public.pending_ai_actions(id) on delete set null,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  bank_hint text,
  account_hint text,
  period_start date,
  period_end date,
  opening_balance numeric,
  closing_balance numeric,
  total_credits numeric not null default 0,
  total_debits numeric not null default 0,
  net_amount numeric not null default 0,
  total_count integer not null default 0,
  duplicate_count integer not null default 0,
  confirmed_count integer not null default 0,
  error_count integer not null default 0,
  errors jsonb,
  raw_extraction jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_import_sessions_user on public.import_sessions(user_id, created_at desc);
create index if not exists idx_import_sessions_status on public.import_sessions(user_id, status);

alter table public.import_sessions enable row level security;

drop policy if exists "IS: own all" on public.import_sessions;
create policy "IS: own all" on public.import_sessions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at_import_sessions on public.import_sessions;
create trigger set_updated_at_import_sessions
  before update on public.import_sessions
  for each row execute function public.tg_set_updated_at();

-- Staging transactions
create table if not exists public.import_staging_transactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.import_sessions(id) on delete cascade,
  user_id uuid not null,
  occurred_at date,
  description text not null default '',
  amount numeric not null default 0,
  kind public.tx_kind not null default 'expense',
  bank_hint text,
  account_hint text,
  category_hint text,
  category_id uuid references public.categories(id) on delete set null,
  confidence numeric,
  is_duplicate boolean not null default false,
  duplicate_of uuid references public.bank_transactions(id) on delete set null,
  status public.import_staging_status not null default 'pending',
  edited boolean not null default false,
  raw_text text,
  raw_data jsonb,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staging_session on public.import_staging_transactions(session_id, position);
create index if not exists idx_staging_user_status on public.import_staging_transactions(user_id, status);

alter table public.import_staging_transactions enable row level security;

drop policy if exists "IST: own all" on public.import_staging_transactions;
create policy "IST: own all" on public.import_staging_transactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at_staging on public.import_staging_transactions;
create trigger set_updated_at_staging
  before update on public.import_staging_transactions
  for each row execute function public.tg_set_updated_at();