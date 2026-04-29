
-- =========================================
-- ENUMS
-- =========================================
create type public.app_role as enum ('admin', 'user');
create type public.account_type as enum ('checking', 'savings', 'investment', 'salary', 'other');
create type public.card_brand as enum ('visa', 'mastercard', 'amex', 'elo', 'hipercard', 'other');
create type public.invoice_status as enum ('open', 'closed', 'paid', 'overdue');
create type public.tx_kind as enum ('income', 'expense', 'transfer', 'investment');
create type public.recurring_status as enum ('active', 'paused', 'cancelled');
create type public.goal_status as enum ('active', 'achieved', 'cancelled');
create type public.investment_class as enum ('renda_fixa', 'acoes', 'fii', 'etf', 'cripto', 'fundo', 'previdencia', 'outros');
create type public.debt_type as enum ('financiamento_imovel', 'financiamento_veiculo', 'emprestimo_pessoal', 'consignado', 'cartao_rotativo', 'cheque_especial', 'renegociacao', 'outros');
create type public.debt_status as enum ('em_dia', 'atrasado', 'renegociado', 'quitado');
create type public.fgts_status as enum ('ativa', 'inativa', 'sacada');
create type public.fgts_entry_type as enum ('deposito', 'saque', 'jam', 'ajuste');
create type public.file_kind as enum ('invoice_pdf', 'bank_statement', 'payslip', 'fgts_statement', 'loan_contract', 'image', 'other');
create type public.alert_severity as enum ('info', 'warning', 'critical');
create type public.report_kind as enum ('simples', 'private');

-- =========================================
-- UTILITIES: updated_at trigger
-- =========================================
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================
-- PROFILES
-- =========================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  plan text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles: select own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Profiles: insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "Profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- USER ROLES (separate table for security)
-- =========================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Roles: select own" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- =========================================
-- AUTO-PROVISION on signup
-- =========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================
-- CATEGORIES
-- =========================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind public.tx_kind not null default 'expense',
  color text,
  icon text,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
create index on public.categories(user_id);
create policy "Cat: own all" on public.categories for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- BANK ACCOUNTS
-- =========================================
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank text not null,
  branch text,
  account_number text,
  account_type public.account_type not null default 'checking',
  balance numeric(14,2) not null default 0,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bank_accounts enable row level security;
create index on public.bank_accounts(user_id);
create policy "BA: own all" on public.bank_accounts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger bank_accounts_uat before update on public.bank_accounts
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- BANK TRANSACTIONS
-- =========================================
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(14,2) not null,
  kind public.tx_kind not null default 'expense',
  occurred_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.bank_transactions enable row level security;
create index on public.bank_transactions(user_id, occurred_at desc);
create policy "BT: own all" on public.bank_transactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- CREDIT CARDS
-- =========================================
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand public.card_brand not null default 'other',
  last_digits text,
  credit_limit numeric(14,2) not null default 0,
  closing_day smallint not null default 1,
  due_day smallint not null default 10,
  variant text default 'graphite',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.credit_cards enable row level security;
create index on public.credit_cards(user_id);
create policy "CC: own all" on public.credit_cards for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger cc_uat before update on public.credit_cards
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- INVOICES
-- =========================================
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  reference_month date not null,
  due_date date not null,
  total_amount numeric(14,2) not null default 0,
  status public.invoice_status not null default 'open',
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
create index on public.invoices(user_id, reference_month desc);
create policy "INV: own all" on public.invoices for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger inv_uat before update on public.invoices
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- INVOICE TRANSACTIONS
-- =========================================
create table public.invoice_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(14,2) not null,
  installment_number smallint,
  installment_total smallint,
  occurred_at date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.invoice_transactions enable row level security;
create index on public.invoice_transactions(user_id, invoice_id);
create policy "IT: own all" on public.invoice_transactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- RECURRING EXPENSES
-- =========================================
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  amount numeric(14,2) not null,
  due_day smallint not null default 1,
  status public.recurring_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recurring_expenses enable row level security;
create index on public.recurring_expenses(user_id);
create policy "RE: own all" on public.recurring_expenses for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger re_uat before update on public.recurring_expenses
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- GOALS
-- =========================================
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null,
  current_amount numeric(14,2) not null default 0,
  deadline date,
  icon text,
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.goals enable row level security;
create index on public.goals(user_id);
create policy "GO: own all" on public.goals for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger go_uat before update on public.goals
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- INVESTMENTS
-- =========================================
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  asset_class public.investment_class not null default 'renda_fixa',
  amount numeric(14,2) not null default 0,
  return_percent numeric(8,2) not null default 0,
  allocation_percent numeric(5,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.investments enable row level security;
create index on public.investments(user_id);
create policy "IV: own all" on public.investments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger iv_uat before update on public.investments
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- LOAN ACCOUNTS (Empréstimos & Dívidas)
-- =========================================
create table public.loan_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null,
  debt_type public.debt_type not null default 'outros',
  original_amount numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  interest_rate numeric(8,4) not null default 0,
  cet numeric(8,4),
  installments_total smallint not null default 0,
  installments_paid smallint not null default 0,
  monthly_payment numeric(14,2) not null default 0,
  due_day smallint not null default 10,
  collateral text,
  status public.debt_status not null default 'em_dia',
  contract_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loan_accounts enable row level security;
create index on public.loan_accounts(user_id);
create policy "LA: own all" on public.loan_accounts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger la_uat before update on public.loan_accounts
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- LOAN PAYMENTS
-- =========================================
create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_account_id uuid not null references public.loan_accounts(id) on delete cascade,
  paid_at date not null default current_date,
  amount numeric(14,2) not null,
  principal numeric(14,2),
  interest numeric(14,2),
  notes text,
  created_at timestamptz not null default now()
);
alter table public.loan_payments enable row level security;
create index on public.loan_payments(user_id, loan_account_id);
create policy "LP: own all" on public.loan_payments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- FGTS ACCOUNTS
-- =========================================
create table public.fgts_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employer text not null,
  cnpj text,
  status public.fgts_status not null default 'ativa',
  balance numeric(14,2) not null default 0,
  monthly_deposit numeric(14,2) not null default 0,
  jam_month numeric(14,2) not null default 0,
  last_movement date,
  statement_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fgts_accounts enable row level security;
create index on public.fgts_accounts(user_id);
create policy "FA: own all" on public.fgts_accounts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger fa_uat before update on public.fgts_accounts
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- FGTS ENTRIES
-- =========================================
create table public.fgts_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fgts_account_id uuid not null references public.fgts_accounts(id) on delete cascade,
  entry_type public.fgts_entry_type not null default 'deposito',
  amount numeric(14,2) not null,
  occurred_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.fgts_entries enable row level security;
create index on public.fgts_entries(user_id, fgts_account_id);
create policy "FE: own all" on public.fgts_entries for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- PAYSLIPS (Contracheques)
-- =========================================
create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employer text not null,
  reference_month date not null,
  gross_amount numeric(14,2) not null default 0,
  net_amount numeric(14,2) not null default 0,
  inss numeric(14,2) default 0,
  irrf numeric(14,2) default 0,
  fgts_amount numeric(14,2) default 0,
  benefits numeric(14,2) default 0,
  pdf_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payslips enable row level security;
create index on public.payslips(user_id, reference_month desc);
create policy "PS: own all" on public.payslips for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger ps_uat before update on public.payslips
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- UPLOADED FILES (registry of all storage objects)
-- =========================================
create table public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  kind public.file_kind not null default 'other',
  related_table text,
  related_id uuid,
  ai_processed boolean not null default false,
  ai_summary text,
  created_at timestamptz not null default now()
);
alter table public.uploaded_files enable row level security;
create index on public.uploaded_files(user_id, created_at desc);
create policy "UF: own all" on public.uploaded_files for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- AI CONVERSATIONS + MESSAGES
-- =========================================
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;
create index on public.ai_conversations(user_id, updated_at desc);
create policy "AC: own all" on public.ai_conversations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger ac_uat before update on public.ai_conversations
  for each row execute function public.tg_set_updated_at();

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
alter table public.ai_messages enable row level security;
create index on public.ai_messages(conversation_id, created_at);
create policy "AM: own all" on public.ai_messages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- ALERTS
-- =========================================
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text,
  severity public.alert_severity not null default 'info',
  is_read boolean not null default false,
  related_table text,
  related_id uuid,
  created_at timestamptz not null default now()
);
alter table public.alerts enable row level security;
create index on public.alerts(user_id, is_read, created_at desc);
create policy "AL: own all" on public.alerts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- SETTINGS
-- =========================================
create table public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'BRL',
  locale text not null default 'pt-BR',
  theme text not null default 'dark',
  hide_balances boolean not null default false,
  notifications_email boolean not null default true,
  notifications_push boolean not null default true,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
create policy "ST: select own" on public.settings for select to authenticated
  using (auth.uid() = user_id);
create policy "ST: insert own" on public.settings for insert to authenticated
  with check (auth.uid() = user_id);
create policy "ST: update own" on public.settings for update to authenticated
  using (auth.uid() = user_id);
create trigger st_uat before update on public.settings
  for each row execute function public.tg_set_updated_at();

-- =========================================
-- REPORTS
-- =========================================
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module text not null,
  title text not null,
  period text not null,
  kind public.report_kind not null default 'simples',
  filters jsonb,
  pdf_path text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create index on public.reports(user_id, created_at desc);
create policy "RP: own all" on public.reports for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================
-- STORAGE BUCKETS (private)
-- =========================================
insert into storage.buckets (id, name, public)
values
  ('invoices', 'invoices', false),
  ('bank-statements', 'bank-statements', false),
  ('payslips', 'payslips', false),
  ('fgts-statements', 'fgts-statements', false),
  ('loan-contracts', 'loan-contracts', false),
  ('images', 'images', false)
on conflict (id) do nothing;

-- Storage policies: each user only sees their own folder (path starts with auth.uid())
do $$
declare
  b text;
begin
  foreach b in array array['invoices','bank-statements','payslips','fgts-statements','loan-contracts','images']
  loop
    execute format($f$
      create policy "Storage select own (%1$s)" on storage.objects
        for select to authenticated
        using (bucket_id = %1$L and auth.uid()::text = (storage.foldername(name))[1]);
    $f$, b);
    execute format($f$
      create policy "Storage insert own (%1$s)" on storage.objects
        for insert to authenticated
        with check (bucket_id = %1$L and auth.uid()::text = (storage.foldername(name))[1]);
    $f$, b);
    execute format($f$
      create policy "Storage update own (%1$s)" on storage.objects
        for update to authenticated
        using (bucket_id = %1$L and auth.uid()::text = (storage.foldername(name))[1]);
    $f$, b);
    execute format($f$
      create policy "Storage delete own (%1$s)" on storage.objects
        for delete to authenticated
        using (bucket_id = %1$L and auth.uid()::text = (storage.foldername(name))[1]);
    $f$, b);
  end loop;
end$$;
