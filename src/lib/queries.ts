import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

/**
 * Lista linhas de uma tabela do schema public, escopadas pelo usuário (RLS faz o resto).
 */
export function useUserList<T = unknown>(
  table: string,
  opts?: { orderBy?: string; ascending?: boolean; select?: string },
) {
  const { user } = useAuth();
  return useQuery<T[]>({
    queryKey: [table, user?.id ?? "anon"],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from(table as never).select(opts?.select ?? "*");
      if (opts?.orderBy) q = q.order(opts.orderBy, { ascending: opts.ascending ?? false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

/** Hook para invalidar uma tabela após mutação. */
export function useInvalidate(table: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return () => qc.invalidateQueries({ queryKey: [table, user?.id ?? "anon"] });
}

/** Insert helper que injeta user_id automaticamente. */
export function useUserInsert<TInput extends Record<string, unknown>>(table: string) {
  const { user } = useAuth();
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: async (input: TInput) => {
      if (!user?.id) throw new Error("Não autenticado");
      const payload = { ...input, user_id: user.id };
      const { data, error } = await supabase
        .from(table as never)
        .insert(payload as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUserUpdate<TInput extends Record<string, unknown>>(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TInput }) => {
      const { data, error } = await supabase
        .from(table as never)
        .update(values as never)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(),
  });
}

export function useUserDelete(table: string) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as never).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => invalidate(),
  });
}
