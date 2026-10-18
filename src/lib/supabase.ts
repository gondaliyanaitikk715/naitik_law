import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function isPrivateKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  try {
    const payload = key.split('.')[1];
    if (!payload) return false;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.role === 'service_role';
  } catch { return false; }
}

function createPublicClient(): SupabaseClient | null {
  if (!url || !publishableKey || isPrivateKey(publishableKey)) return null;
  try {
    // Public read access is enforced by the existing project's RLS policies.
    return createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } catch {
    return null;
  }
}

export const supabase = createPublicClient();
export const isSupabaseConfigured = supabase !== null;
