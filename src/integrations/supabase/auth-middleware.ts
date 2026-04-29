import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Response('Missing Supabase environment variables', { status: 500 });
    }

    // Tenta pegar token do header Authorization OU do cookie sb-auth-token
    let token: string | null = null;
    
    const request = getRequest();
    if (request?.headers) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
      // Fallback: cookie do Supabase
      if (!token) {
        const cookieHeader = request.headers.get('cookie') ?? '';
        const match = cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/);
        if (match) {
          try {
            const decoded = decodeURIComponent(match[1]);
            const parsed = JSON.parse(decoded);
            token = parsed?.access_token ?? null;
          } catch { /* ignore */ }
        }
      }
    }

    if (!token) {
      throw new Response('Unauthorized: No token found', { status: 401 });
    }

    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
        auth: {
          storage: undefined,
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      throw new Response('Unauthorized: Invalid token', { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId: userData.user.id,
        claims: userData.user,
      },
    });
  }
);
