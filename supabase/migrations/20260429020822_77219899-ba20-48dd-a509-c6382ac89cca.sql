-- Enum para tipo de ação pendente
DO $$ BEGIN
  CREATE TYPE public.pending_action_kind AS ENUM ('fatura', 'extrato', 'fgts', 'emprestimo', 'contracheque');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pending_action_status AS ENUM ('pending', 'confirmed', 'discarded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pending_ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.pending_action_kind NOT NULL,
  status public.pending_action_status NOT NULL DEFAULT 'pending',
  source_file_id uuid,
  conversation_id uuid,
  message_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  confirmed_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_ai_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PAA: own all"
  ON public.pending_ai_actions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_paa_updated_at
  BEFORE UPDATE ON public.pending_ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_paa_user_status ON public.pending_ai_actions(user_id, status, created_at DESC);