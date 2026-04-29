do $$ begin
  create type public.ai_audit_status as enum ('success','error','warning');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ai_audit_action as enum (
    'extract','confirm','discard','duplicate_detected','partial_confirm','edit_before_confirm'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action public.ai_audit_action not null,
  doc_kind public.pending_action_kind,
  pending_action_id uuid,
  status public.ai_audit_status not null default 'success',
  message text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_audit_logs enable row level security;

drop policy if exists "AAL: own all" on public.ai_audit_logs;
create policy "AAL: own all"
  on public.ai_audit_logs for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists ai_audit_logs_user_created_idx
  on public.ai_audit_logs (user_id, created_at desc);