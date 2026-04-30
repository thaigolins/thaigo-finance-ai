ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS bank_color text,
  ADD COLUMN IF NOT EXISTS bank_logo text;