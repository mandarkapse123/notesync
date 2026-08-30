import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'notesync_supabase_url';
const STORAGE_KEY_ANON_KEY = 'notesync_supabase_anon_key';

export function getStoredSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const storedKey = localStorage.getItem(STORAGE_KEY_ANON_KEY) || envKey;

  return {
    url: storedUrl.trim(),
    anonKey: storedKey.trim(),
  };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  if (url.trim()) {
    localStorage.setItem(STORAGE_KEY_URL, url.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_URL);
  }

  if (anonKey.trim()) {
    localStorage.setItem(STORAGE_KEY_ANON_KEY, anonKey.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY_ANON_KEY);
  }

  // Reset singleton so next access creates new client
  supabaseInstance = null;
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey) return null;

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await client.from('topics').select('id').limit(1);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Connected to Supabase successfully! 🚀' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Connection failed' };
  }
}
