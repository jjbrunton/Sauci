import { createClient } from '@supabase/supabase-js';

export const supabaseConfig = {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

export const supabase = createClient(
    supabaseConfig.url,
    supabaseConfig.anonKey
);
